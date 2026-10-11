// What-If engine. Grounding rules (README):
//  1. Evidence is selected by a fixed database query per persona x feature (same input -> same evidence).
//  2. The model only sees that evidence, each item with an ID, and must cite IDs.
//  3. The server drops any cited ID that was not in the evidence and records it as rejected.
//  4. Too little evidence -> "Not enough evidence" without calling the model.
//  5. Same question + same evidence -> the stored run is returned, not a new answer.
import { createHash } from "node:crypto"

import { createClient } from "@supabase/supabase-js"

import { EUROPE } from "@/lib/data"
import { FEATURES, FEATURE_MAP_VERSION, featureOf, type Feature } from "@/lib/features"
import AM1 from "@/personas/AM-1.json"
import AM2 from "@/personas/AM-2.json"
import AM3 from "@/personas/AM-3.json"
import AS1 from "@/personas/AS-1.json"
import AS2 from "@/personas/AS-2.json"
import AS3 from "@/personas/AS-3.json"
import EU1 from "@/personas/EU-1.json"
import EU2 from "@/personas/EU-2.json"
import EU3 from "@/personas/EU-3.json"

export const MODEL = "gpt-4.1"
export const PROMPT_VERSION = "whatif-v2"
const MIN_COMMENTS = 3

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

// Which slice of the data each persona stands for. From the persona files' market and cohort fields.
type StudyMarket = "US" | "EU" | "CN" | null
const PERSONA_SCOPE: Record<string, { countries: string[]; engines: string[] | null; study: StudyMarket }> = {
  "AM-1": { countries: ["US", "CA"], engines: ["BEVE"], study: "US" },
  "AM-2": { countries: ["US", "CA"], engines: ["ICE"], study: "US" },
  "AM-3": { countries: ["US", "CA"], engines: null, study: "US" },
  "EU-1": { countries: EUROPE, engines: ["BEVE"], study: "EU" },
  "EU-2": { countries: EUROPE, engines: null, study: "EU" },
  "EU-3": { countries: EUROPE, engines: ["ICE"], study: "EU" },
  "AS-1": { countries: ["CN"], engines: null, study: "CN" },
  "AS-2": { countries: ["CN"], engines: null, study: "CN" },
  "AS-3": { countries: ["KR", "JP"], engines: null, study: null },
}
const PERSONA_FILES = [AM1, AM2, AM3, EU1, EU2, EU3, AS1, AS2, AS3]

export const VERDICTS = [
  "more_likely",
  "slightly_more_likely",
  "no_effect",
  "slightly_less_likely",
  "less_likely",
  "not_enough_evidence",
] as const
export type Verdict = (typeof VERDICTS)[number]

export type Change = {
  feature_id: string | null
  change_type: string
  summary: string
  cost_impact_eur: number | null
}

export type EvidenceComment = {
  id: string
  country: string
  engine: string
  sentiment: string
  taxonomy: string | null
  excel_row: number
  text: string
}
export type EvidenceStudy = { id: string; source: string; market: string; model: string; attribute: string; metric: string; value: number }
export type EvidenceOption = { id: string; code: string; name: string; price_eur: number | null; page: number; contents: string }
export type Evidence = {
  comments: EvidenceComment[]
  totals: Record<string, number>
  study: EvidenceStudy[]
  options: EvidenceOption[]
  scope: string
}

export type VerdictRow = {
  persona_id: string
  verdict: Verdict
  confidence: "high" | "medium" | "low"
  reaction: string | null
  reason: string | null
  assumptions: string[]
  supporting_ids: string[]
  opposing_ids: string[]
  dropped_citations: string[]
  evidence: Evidence
  llm_called: boolean
}

// ---------- OpenAI (structured outputs) ----------
async function llm<T>(system: string, user: string, name: string, schema: object): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      seed: 7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content) as T
}

// ---------- Step 1: read the question into a structured change ----------
const CHANGE_TYPES = ["make_standard", "add_option", "remove", "improve", "simplify", "price_increase", "price_decrease", "other"]

export async function parseChange(question: string, vehicleName: string): Promise<Change> {
  const list = FEATURES.map((f) => `- ${f.id}: ${f.name}. ${f.description}`).join("\n")
  return llm<Change>(
    `You turn a BMW product manager's what-if question about the next ${vehicleName} into a structured change. ` +
      `Pick the ONE feature from the list that the change is mainly about, or null if none fits. Do not invent features.\n\nFeatures:\n${list}`,
    question,
    "change",
    {
      type: "object",
      additionalProperties: false,
      required: ["feature_id", "change_type", "summary", "cost_impact_eur"],
      properties: {
        feature_id: { type: ["string", "null"], enum: [...FEATURES.map((f) => f.id), null] },
        change_type: { type: "string", enum: CHANGE_TYPES },
        summary: { type: "string", description: "The change restated in one plain sentence." },
        cost_impact_eur: { type: ["number", "null"], description: "Price change for the customer in EUR if stated, else null." },
      },
    }
  )
}

// ---------- Step 2: evidence, selected the same way every time ----------
const STUDY_SLICE = {
  US: { sheet: "US_2025", market: "US", models: ["G60", "G70"], metric: "top2box" },
  EU: { sheet: "CN_EU_2025", market: "EU", models: ["BMW 5 Series G60", "BMW 7 Series G70"], metric: "mean" },
  CN: { sheet: "CN_EU_2025", market: "China", models: ["BMW 5 Series G68", "BMW 7 Series G70"], metric: "mean" },
} as const

export async function gatherEvidence(personaId: string, feature: Feature, vehicle: string): Promise<Evidence> {
  const db = admin()
  const scope = PERSONA_SCOPE[personaId]
  const studyCfg = scope.study ? STUDY_SLICE[scope.study] : null
  const attrs = scope.study === "US" ? feature.studyUS : feature.studyCNEU

  const [comments, study, options] = await Promise.all([
    db.rpc("evidence_comments", {
      p_model: vehicle,
      p_countries: scope.countries,
      p_engines: scope.engines,
      p_level2: feature.level2,
      p_pattern: feature.pattern,
      p_per_sentiment: 8,
    }),
    studyCfg && attrs.length
      ? db
          .from("study_metric")
          .select("market, model, attribute, metric, value, source_cell")
          .eq("sheet", studyCfg.sheet)
          .eq("market", studyCfg.market)
          .eq("metric", studyCfg.metric)
          .in("model", [...studyCfg.models])
          .in("attribute", attrs)
          .order("source_cell")
      : Promise.resolve({ data: [], error: null }),
    feature.options.length
      ? db.from("option_item").select("code, name, price_gross, page, description").eq("model", vehicle).in("code", feature.options).order("id")
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [comments, study, options]) if (r.error) throw new Error(r.error.message)

  const rows = (comments.data ?? []) as {
    comment_id: string; country: string; engine_type: string; text: string; sentiment: string
    level2: string | null; excel_row: number; total_in_sentiment: number
  }[]
  const totals: Record<string, number> = {}
  for (const r of rows) totals[r.sentiment] = Number(r.total_in_sentiment)

  return {
    scope: `${vehicle} feedback from ${scope.countries.length > 5 ? "Europe" : scope.countries.join("/")}${scope.engines ? ` (${scope.engines.join("/").replace("BEVE", "BEV")})` : ""}; study: ${scope.study ?? "none"}`,
    comments: rows.map((r) => ({
      id: r.comment_id,
      country: r.country,
      engine: r.engine_type === "BEVE" ? "BEV" : r.engine_type,
      sentiment: r.sentiment,
      taxonomy: r.level2,
      excel_row: r.excel_row,
      text: r.text.length > 600 ? r.text.slice(0, 600) + "…" : r.text,
    })),
    totals,
    study: ((study.data ?? []) as { market: string; model: string; attribute: string; metric: string; value: number; source_cell: string }[]).map((s, i) => ({
      id: `STUDY-${i + 1}`,
      source: s.source_cell,
      market: s.market,
      model: s.model,
      attribute: s.attribute,
      metric: s.metric,
      value: s.value,
    })),
    options: ((options.data ?? []) as { code: string; name: string; price_gross: number | null; page: number; description: string | null }[]).map((o, i) => ({
      id: `OPT-${o.code}-${i + 1}`,
      code: o.code,
      name: o.name,
      price_eur: o.price_gross,
      page: o.page,
      contents: (o.description ?? "").slice(0, 300),
    })),
  }
}

const evidenceIds = (e: Evidence) => [...e.comments.map((c) => c.id), ...e.study.map((s) => s.id), ...e.options.map((o) => o.id)]

// ---------- Step 3: one persona reacts, citing only its evidence ----------
type LlmVerdict = Omit<VerdictRow, "persona_id" | "dropped_citations" | "evidence" | "llm_called">

function personaBrief(p: (typeof PERSONA_FILES)[number]) {
  const cf = p.cluster_foundation as { cluster_name?: string; key_stats?: unknown }
  return [
    `Segment: ${p.label} (${p.persona_id}). Market: ${p.market}. Cohort: ${p.cohort}.`,
    `Behavioural cluster: ${cf.cluster_name ?? "n/a"}; key stats: ${JSON.stringify(cf.key_stats ?? {})}.`,
    `Evidence tier: ${p.evidence_tier}.`,
    `Open assumptions: ${(p.assumptions_register as { assumption: string }[]).map((a) => a.assumption).join(" | ")}`,
    `This segment would be proven wrong if: ${(p.falsification_criteria as string[]).join(" | ")}`,
  ].join("\n")
}

async function react(persona: (typeof PERSONA_FILES)[number], change: Change, feature: Feature, ev: Evidence, vehicleName: string): Promise<LlmVerdict> {
  const evidenceText = [
    `Customer comments (${ev.scope}). Shown per sentiment, totals: ${JSON.stringify(ev.totals)}`,
    ...ev.comments.map((c) => `[${c.id}] (${c.sentiment}, ${c.country}, ${c.engine}, class: ${c.taxonomy}) ${c.text}`),
    ev.study.length ? `Customer study (${ev.study[0].metric}; G70 = 7 Series shown for comparison):` : "Customer study: none for this market.",
    ...ev.study.map((s) => `[${s.id}] ${s.model} · ${s.attribute}: ${s.metric === "top2box" ? (s.value * 100).toFixed(1) + "% top-2-box" : s.value.toFixed(2) + " mean (scale not stated)"}`),
    ev.options.length ? "Current price list (Germany, July 2026):" : "",
    ...ev.options.map((o) => `[${o.id}] ${o.code} ${o.name}: EUR ${o.price_eur ?? "n/a"}. Contents: ${o.contents}`),
  ].join("\n")

  return llm<LlmVerdict>(
    `You simulate how ONE evidence-based customer segment of the BMW ${vehicleName} would react to a proposed change for the successor model (about 2030). ` +
      `You are not a real customer and this is not a vote. Use ONLY the evidence below; every item has an ID in square brackets.\n` +
      `Rules:\n- Cite the IDs that support the verdict (supporting_ids) and that argue against it (opposing_ids). Only IDs from the evidence.\n` +
      `- If the evidence does not speak to this change for this segment, answer not_enough_evidence. That is a good answer.\n` +
      `- Never invent numbers, prices, or quotes. Keep the reaction to 1-2 sentences in the segment's voice, and the reason to 1 sentence in an analyst's voice.\n` +
      `- The reaction may only refer to things in the segment description or in the evidence. Do not mention family, children, competitors, weather or anything else unless an evidence item says so.\n` +
      `- Weigh what this segment cares about (its cluster and stats). A change it does not care about is no_effect, even if it is nice.\n` +
      `- assumptions: forward-looking assumptions your verdict depends on (max 2).\n\n${personaBrief(persona)}`,
    `Proposed change: ${change.summary} (feature: ${feature.name}; change type: ${change.change_type}; customer price impact: ${change.cost_impact_eur ?? "not stated"} EUR)\n\nEVIDENCE\n${evidenceText}`,
    "verdict",
    {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "confidence", "reaction", "reason", "assumptions", "supporting_ids", "opposing_ids"],
      properties: {
        verdict: { type: "string", enum: [...VERDICTS] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        reaction: { type: "string" },
        reason: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        supporting_ids: { type: "array", items: { type: "string" } },
        opposing_ids: { type: "array", items: { type: "string" } },
      },
    }
  )
}

async function verdictFor(persona: (typeof PERSONA_FILES)[number], change: Change, feature: Feature, ev: Evidence, vehicleName: string): Promise<VerdictRow> {
  const base = { persona_id: persona.persona_id, evidence: ev, dropped_citations: [] as string[] }
  if (ev.comments.length < MIN_COMMENTS && ev.study.length === 0) {
    return {
      ...base,
      verdict: "not_enough_evidence",
      confidence: "high",
      reaction: null,
      reason: `Only ${ev.comments.length} matching comment(s) and no study items for this segment. The model was not asked.`,
      assumptions: [],
      supporting_ids: [],
      opposing_ids: [],
      llm_called: false,
    }
  }
  const out = await react(persona, change, feature, ev, vehicleName)
  const allowed = new Set(evidenceIds(ev))
  const dropped = [...out.supporting_ids, ...out.opposing_ids].filter((id) => !allowed.has(id))
  const supporting_ids = [...new Set(out.supporting_ids.filter((id) => allowed.has(id)))]
  const opposing_ids = [...new Set(out.opposing_ids.filter((id) => allowed.has(id)))]
  const uncited = out.verdict !== "not_enough_evidence" && supporting_ids.length + opposing_ids.length === 0
  // Confidence can never exceed what the volume of evidence supports (deterministic cap).
  const cap = ev.comments.length < MIN_COMMENTS ? "low" : ev.comments.length < 8 ? "medium" : "high"
  const rank = { low: 0, medium: 1, high: 2 } as const
  const confidence = rank[out.confidence] > rank[cap] ? cap : out.confidence
  return {
    ...base,
    ...out,
    confidence,
    verdict: uncited ? "not_enough_evidence" : out.verdict,
    reason: uncited ? "The model gave no valid citations, so the verdict was withheld." : out.reason,
    supporting_ids,
    opposing_ids,
    dropped_citations: dropped,
    llm_called: true,
  }
}

// ---------- The whole run, with the "same question + same evidence = same answer" cache ----------
export type Run = {
  id: string
  created_at: string
  vehicle: string
  question: string
  change: Change
  feature_id: string | null
  model: string
  prompt_version: string
  feature_map_version: string
  evidence_hash: string
  duration_ms: number | null
  verdicts: VerdictRow[]
  cached?: boolean
}

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ")

async function evidenceAll(feature: Feature, vehicle: string) {
  const list = await Promise.all(PERSONA_FILES.map(async (p) => [p.persona_id, await gatherEvidence(p.persona_id, feature, vehicle)] as const))
  const map = Object.fromEntries(list) as Record<string, Evidence>
  const hash = createHash("sha256")
    .update(JSON.stringify(list.map(([id, e]) => [id, evidenceIds(e)])) + FEATURE_MAP_VERSION)
    .digest("hex")
    .slice(0, 16)
  return { map, hash }
}

export async function loadRun(id: string): Promise<Run | null> {
  const db = admin()
  const [run, verdicts] = await Promise.all([
    db.from("simulation_run").select("*").eq("id", id).maybeSingle(),
    db.from("simulation_verdict").select("*").eq("run_id", id),
  ])
  if (run.error || !run.data) return null
  return { ...(run.data as Omit<Run, "verdicts">), verdicts: (verdicts.data ?? []) as VerdictRow[] }
}

export async function runWhatIf(question: string, vehicle: string, vehicleName: string): Promise<Run> {
  const t0 = Date.now()
  const db = admin()
  const qn = norm(question)

  // Cache: a previous run of the same question whose evidence is unchanged is returned as is.
  const prev = await db
    .from("simulation_run")
    .select("id, change, feature_id, evidence_hash")
    .eq("vehicle", vehicle)
    .eq("question_norm", qn)
    .eq("prompt_version", PROMPT_VERSION)
    .eq("feature_map_version", FEATURE_MAP_VERSION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  let change: Change
  if (prev.data) {
    change = prev.data.change as Change
    const f = change.feature_id ? featureOf(change.feature_id) : null
    const hash = f ? (await evidenceAll(f, vehicle)).hash : "none"
    if (hash === prev.data.evidence_hash) {
      const run = await loadRun(prev.data.id)
      if (run) return { ...run, cached: true }
    }
  } else {
    change = await parseChange(question, vehicleName)
  }

  const feature = change.feature_id ? featureOf(change.feature_id) : null
  let verdicts: VerdictRow[] = []
  let hash = "none"
  if (feature) {
    const ev = await evidenceAll(feature, vehicle)
    hash = ev.hash
    verdicts = await Promise.all(PERSONA_FILES.map((p) => verdictFor(p, change, feature, ev.map[p.persona_id], vehicleName)))
  }

  const ins = await db
    .from("simulation_run")
    .insert({
      vehicle,
      question,
      question_norm: qn,
      change,
      feature_id: feature?.id ?? null,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      feature_map_version: FEATURE_MAP_VERSION,
      evidence_hash: hash,
      duration_ms: Date.now() - t0,
    })
    .select()
    .single()
  if (ins.error) throw new Error(ins.error.message)
  if (verdicts.length) {
    const v = await db.from("simulation_verdict").insert(verdicts.map((x) => ({ ...x, run_id: ins.data.id })))
    if (v.error) throw new Error(v.error.message)
  }
  return { ...(ins.data as Omit<Run, "verdicts">), verdicts }
}
