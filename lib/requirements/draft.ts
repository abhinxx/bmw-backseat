// Requirements, step 3: the AI drafts the text of each candidate from the evidence it is given, and nothing else.
// Same grounding as What-If: every evidence item has an ID; the server drops cited IDs that were not given.
import { EUROPE } from "@/lib/data"
import type { Feature } from "@/lib/features"
import { DRAFT_MODEL, DRAFT_PROMPT_VERSION, KIND_LABEL, LIMITS } from "@/lib/requirements/config"
import { admin, type Candidate } from "@/lib/requirements/signals"
import type { ReqKind, SourceRef, UploadedRow } from "@/lib/requirements/types"

export type AiKey = { key: string; model: string } | null

export type Draft = {
  title: string
  description: string
  target: string | null
  rationale: string | null
  assumptions: string[]
  uncertainties: string[]
  supporting_ids: string[]
  opposing_ids: string[]
}

export async function chat<T>(system: string, user: string, name: string, schema: object, ai: AiKey, effort = "medium"): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + (ai?.key || process.env.OPENAI_API_KEY), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: ai?.model || DRAFT_MODEL,
      reasoning_effort: effort,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: drafting request failed. Check your key/model in Settings. No draft was saved.`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content) as T
}

const enc = encodeURIComponent
const clip = (s: string | null | undefined, n = 400) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : "")

/** The evidence one candidate is drafted from: same selection every time for the same database and options. */
export async function evidenceFor(c: Candidate, vehicle: string, countries: string[], csv: UploadedRow[]): Promise<SourceRef[]> {
  const db = admin()
  const f = c.feature
  const [comments, options] = await Promise.all([
    db.rpc("evidence_comments", { p_model: vehicle, p_countries: countries, p_engines: null, p_level2: f.level2, p_pattern: f.pattern, p_per_sentiment: 8 }),
    f.options.length ? db.from("option_item").select("code, name, price_gross, page").eq("model", vehicle).in("code", f.options).order("id") : Promise.resolve({ data: [], error: null }),
  ])
  if (comments.error) throw new Error(comments.error.message)
  type C = { comment_id: string; country: string; text: string; sentiment: string; excel_row: number }
  const rows = (comments.data ?? []) as C[]
  const take = (s: string, n: number) => rows.filter((r) => r.sentiment === s).slice(0, n)
  const picked =
    c.kind === "protect" ? [...take("positive", 8), ...take("negative", 2), ...take("want", 2)] : [...take("negative", 6), ...take("want", 4), ...take("positive", 2)]
  const region = (cc: string) => (cc === "US" ? "US" : cc === "CN" ? "China" : EUROPE.includes(cc) ? "Europe" : cc)
  const sentimentLabel: Record<string, string> = { positive: "praise", negative: "complaint", want: "wish" }

  const out: SourceRef[] = []
  for (const r of picked.slice(0, LIMITS.commentsPerRequirement))
    out.push({
      id: r.comment_id,
      kind: "comment",
      label: `Customer ${sentimentLabel[r.sentiment] ?? r.sentiment}, ${region(r.country)}, Excel row ${r.excel_row}`,
      text: clip(r.text),
      href: `/evidence/comment/${enc(r.comment_id)}`,
      role: (c.kind === "protect" ? r.sentiment === "positive" : r.sentiment !== "positive") ? "supports" : "opposes",
    })
  c.study.forEach((p, i) =>
    out.push({
      id: `STUDY-${i + 1}`,
      kind: "study",
      label: `Customer study ${p.market}, ${p.attribute.trim()}`,
      text: `${p.ownModel.replace("BMW ", "")} ${p.metric === "top2box" ? Math.round(p.own * 1000) / 10 + "% top-2-box" : p.own.toFixed(2) + " mean"} vs best sibling ${p.bestModel.replace("BMW ", "")} ${p.metric === "top2box" ? Math.round(p.best * 1000) / 10 + "%" : p.best.toFixed(2)}`,
      href: `/evidence/study/${enc(p.cell)}`,
      role: (c.kind === "protect" ? p.own >= p.best : p.own < p.best) ? "supports" : "opposes",
    })
  )
  ;((options.data ?? []) as { code: string; name: string; price_gross: number | null; page: number }[]).forEach((o) =>
    out.push({
      id: `OPT-${o.code}`,
      kind: "option",
      label: `Price list ${vehicle}, page ${o.page}`,
      text: `${o.name} (${o.code})${o.price_gross ? `, EUR ${o.price_gross.toLocaleString("en-US")}` : ", price not listed"}`,
      href: `/evidence/option/${enc(`${vehicle}-${o.code}`)}`,
      role: "context",
    })
  )
  c.rivals.forEach((r, i) =>
    out.push({ id: `RIVAL-${i + 1}`, kind: "rival", label: `Rival table: ${r.rival}, ${r.topic.replace(/_/g, " ")}`, text: r.value, href: `/evidence/public/${enc(r.id)}`, role: "context" })
  )
  c.publicItems.slice(0, 6).forEach((p, i) =>
    out.push({
      id: `PUB-${i + 1}`,
      kind: "public",
      label: p.kind === "trend" ? "Industry study" : p.channel,
      text: clip(p.quote ?? p.title, 300),
      href: `/evidence/public/${enc(p.id)}`,
      role: p.agrees ? "supports" : "context",
    })
  )
  c.research.slice(0, 6).forEach((r, i) =>
    out.push({
      id: `RES-${i + 1}`,
      kind: "research",
      label: `Research Agent, ${r.channel}${r.relation ? `, ${r.relation.replace("_", " ")}` : ""}`,
      text: clip(r.quote || r.claim, 300),
      href: r.url,
      role: r.relation === "agrees" ? "supports" : r.relation === "contradicts" ? "opposes" : "context",
    })
  )
  if (c.sim)
    out.push({
      id: "SIM-1",
      kind: "whatif",
      label: "What-If simulation (simulated, not a customer vote)",
      text: `"${c.sim.question}": ${Object.entries(c.sim.counts).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ")}`,
      href: `/what-if?v=${vehicle}&run=${c.sim.run_id}`,
      role: "context",
    })
  // CSV rows: only the ones that mention this feature (taxonomy words or text pattern); context only.
  if (csv.length) {
    const words = [...f.level2, f.name].flatMap((s) => s.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length > 4)
    const re = f.pattern ? new RegExp(f.pattern.replace(/\\m|\\M/g, "\\b"), "i") : null
    csv
      .filter((r) => (re && re.test(r.text)) || words.some((w) => r.text.toLowerCase().includes(w)))
      .slice(0, LIMITS.csvRowsPerRequirement)
      .forEach((r) => out.push({ id: r.id, kind: "csv", label: "Uploaded CSV row (unverified)", text: clip(r.text, 300), href: null, role: "context" }))
  }
  return out
}

const SYSTEM = (vehicleName: string) =>
  `You draft ONE customer-facing product requirement for the successor of the BMW ${vehicleName} (on the road around 2030), for a BMW product manager who must defend it at a project gate.

What a requirement is (BMW's definition): a customer-relevant attribute of the car, in plain words, that the PM can approve or reject. Not an engineering spec, not a business case.

Requirement types:
- fix: remove a pain point customers report today.
- add: meet an unmet want or close a gap against rivals.
- protect: keep something customers love; the successor must not lose it.

Write:
- title: at most 10 words, the customer-relevant attribute itself (e.g. "Climate and volume work without the touchscreen"). No verbs like "Improve" alone, no marketing words.
- description: one or two sentences saying what the customer can do or experience in the successor ("The driver can..." / "The successor keeps..."). Specific enough to test.
- target: ONE measurable target with a number that would show the requirement is met (e.g. "At least 75% top-2-box on 'Comfort of 2nd row seat' in the US study, today 47%"). Use numbers from the evidence or factors only as the baseline; the target value itself is your forward-looking proposal. null if no sensible measurable target exists.
- rationale: two or three sentences on why this deserves its priority, using ONLY the factor details and evidence given. Cite evidence IDs in square brackets, e.g. [G60-0435] [STUDY-2]. Never write a number that is not in the factors or evidence.
- assumptions: two or three forward-looking assumptions that must hold by about 2030 for this requirement to be right (about customers, markets, technology or rivals). Do not restate the requirement.
- uncertainties: one to three things the evidence cannot tell or where it conflicts (sample coverage, one-sided markets, mixed signals, simulated or unverified sources).
- supporting_ids: IDs of the evidence items that support the requirement. opposing_ids: IDs that argue against it. Only IDs from the list.

Rules:
- Use only the evidence and factors given. Do not invent rivals, prices, quotes, studies or numbers.
- BMW internal data outranks public data, which outranks research findings, which outrank simulations. CSV rows uploaded by the PM are unverified context.
- What-If results are simulated reactions, not customer votes; never present them as facts.
- Plain, calm English. No em dashes.`

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "target", "rationale", "assumptions", "uncertainties", "supporting_ids", "opposing_ids"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    target: { type: ["string", "null"] },
    rationale: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
    supporting_ids: { type: "array", items: { type: "string" } },
    opposing_ids: { type: "array", items: { type: "string" } },
  },
}

export function draftInput(c: Candidate, evidence: SourceRef[]) {
  const f: Feature = c.feature
  return [
    `Feature: ${f.name}. ${f.description}`,
    `Requirement type: ${c.kind} (${KIND_LABEL[c.kind].hint}).`,
    `Markets where the signal shows: ${c.markets.join(", ") || "none"}.`,
    `Priority factors (computed by code from the database; value 0-1):`,
    ...c.factors.map((x) => `- ${x.label}: ${x.value === null ? "n/a" : x.value} (weight ${x.weight}). ${x.detail}`),
    `Score ${c.score}/100, ${c.priority}, evidence level ${c.evidence_level}.`,
    c.conflicts.length ? `Conflicting signals found by code:\n${c.conflicts.map((x) => `- ${x}`).join("\n")}` : `Conflicting signals found by code: none.`,
    `Evidence (cite by ID):`,
    ...evidence.map((e) => `[${e.id}] (${e.label}) ${e.text ?? ""}`),
  ].join("\n")
}

/** Draft one requirement. Citations outside the evidence are dropped and counted. */
export async function draft(c: Candidate, evidence: SourceRef[], vehicleName: string, ai: AiKey): Promise<{ draft: Draft; dropped: string[]; fallback: boolean }> {
  const ids = new Set(evidence.map((e) => e.id))
  try {
    const d = await chat<Draft>(SYSTEM(vehicleName), draftInput(c, evidence), "requirement_draft", SCHEMA, ai)
    const cited = [...d.supporting_ids, ...d.opposing_ids, ...[...(d.rationale ?? "").matchAll(/\[([^\]\s]+)\]/g)].map((m) => m[1])]
    const dropped = [...new Set(cited.filter((x) => !ids.has(x)))]
    const supporting_ids = d.supporting_ids.filter((x) => ids.has(x))
    const opposing_ids = d.opposing_ids.filter((x) => ids.has(x))
    let rationale = d.rationale
    for (const x of dropped) rationale = rationale?.split(`[${x}]`).join("") ?? null
    if (!supporting_ids.length) return { draft: fallbackDraft(c), dropped, fallback: true }
    return { draft: { ...d, rationale, supporting_ids, opposing_ids }, dropped, fallback: false }
  } catch (e) {
    throw e
  }
}

const VERB: Record<ReqKind, string> = { fix: "Fix", add: "Add", protect: "Keep" }
function fallbackDraft(c: Candidate): Draft {
  return {
    title: `${VERB[c.kind]}: ${c.feature.name}`,
    description: c.feature.description,
    target: null,
    rationale: null,
    assumptions: [],
    uncertainties: ["The AI draft was withheld because it did not cite valid evidence. Factors and evidence are still shown."],
    supporting_ids: [],
    opposing_ids: [],
  }
}

export const DRAFT_ACTOR = (ai: AiKey) => `${ai?.model || DRAFT_MODEL} · ${DRAFT_PROMPT_VERSION}${ai ? " · PM's own key" : ""}`
