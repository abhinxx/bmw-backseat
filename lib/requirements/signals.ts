// Requirements, step 1+2: read every signal for one car line from the database and turn it into
// candidates with priority factors. Pure code: same database + same options -> same numbers.
import { createClient } from "@supabase/supabase-js"

import { EUROPE } from "@/lib/data"
import { FEATURES, type Feature } from "@/lib/features"
import { CANDIDATE_RULE, FACTORS, priorityOf } from "@/lib/requirements/config"
import type { EvidenceGrade, Factor, FactorId, GenerateOptions, ReqKind } from "@/lib/requirements/types"

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

type Bucket = "EU" | "US" | "CN" | "RoW"
const BUCKETS: Bucket[] = ["EU", "US", "CN", "RoW"]
const BUCKET_NAME: Record<Bucket, string> = { EU: "Europe", US: "US", CN: "China", RoW: "Rest of world" }
const SALES_SHEET: Record<string, string> = { G60: "G60_G68", G70: "G70", F70: "F70" }

// Customer study: the model names this car line has in each slice. Compared against the best other BMW in the slice.
const STUDY_OWN: Record<string, { US?: string; EU?: string; China?: string }> = {
  G60: { US: "G60", EU: "BMW 5 Series G60", China: "BMW 5 Series G68" },
  G70: { US: "G70", EU: "BMW 7 Series G70", China: "BMW 7 Series G70" },
  F70: { EU: "BMW 1 Series F70" },
}

// Public data -> the same 16 features (versioned with SCORE_VERSION).
const RIVAL_TOPIC: Record<string, string> = {
  rear_seat_heating: "rear_comfort",
  rear_climate: "rear_comfort",
  hands_free_driving: "driver_assist",
  voice_ai_assistant: "voice_assistant",
  controls: "controls",
  center_display: "controls",
  ev_range_wltp_km: "ev_range_charging",
  dc_charging_kw: "ev_range_charging",
  base_price: "price_value",
}
// Only these rival topics say whether a rival offers something; the rest are specs (context only).
const RIVAL_PRESENCE = new Set(["rear_seat_heating", "rear_climate", "hands_free_driving", "voice_ai_assistant"])
const QUOTE_TOPIC: Record<string, string> = {
  controls: "controls",
  driving: "driving_dynamics",
  ev_range_charging: "ev_range_charging",
  price_value: "price_value",
  quality: "interior_quality",
  rear_comfort: "rear_comfort",
}
// Industry studies that report problems with a feature (count as an outside channel for fix / add).
const TREND_PROBLEM_TOPIC: Record<string, string> = {
  "TXI tech problems": "controls",
  "Physical buttons return": "controls",
  "IQS industry quality": "reliability",
}
const QUOTE_CHANNEL = (sourceId: string) =>
  sourceId.includes("china") ? "Chinese owner reports" : sourceId.includes("europe") ? "European owner reports" : "US owner forums"
const RESEARCH_CHANNEL = (url: string) => {
  const h = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return ""
    }
  })()
  if (h.includes("reddit.com")) return "Reddit"
  if (/(x|twitter)\.com$/.test(h)) return "X"
  if (/youtube|tiktok|facebook/.test(h)) return "Video and social"
  if (/bimmerpost|bimmerfest|mbworld|audizine|motor-talk|forum|autohome|dongchedi/.test(h + url)) return "Owner forums"
  return "Press and web"
}

type Sent = "positive" | "negative" | "want"
export type Counts = { positive: number; negative: number; want: number; byBucket: Record<Sent, Record<Bucket, number>> }
export type StudyPair = { market: string; attribute: string; metric: string; own: number; best: number; bestModel: string; cell: string; ownModel: string }
export type RivalCell = { id: string; topic: string; rival: string; value: string; status: "standard" | "option" | "offered" | "not_offered" | "unknown"; url: string | null }
export type PublicItem = { id: string; kind: "owner_quote" | "trend"; channel: string; title: string; quote: string | null; stance: string | null; url: string | null; agrees: boolean }
export type ResearchItem = { id: string; channel: string; claim: string; quote: string; url: string; stance: string | null; relation: string | null; run_id: string }
export type SimSummary = { run_id: string; question: string; created_at: string; counts: Record<string, number>; called: number }

export type Candidate = {
  feature: Feature
  kind: ReqKind
  counts: Counts
  study: StudyPair[]
  rivals: RivalCell[]
  publicItems: PublicItem[]
  research: ResearchItem[]
  sim: SimSummary | null
  factors: Factor[]
  score: number
  priority: ReturnType<typeof priorityOf>
  evidence_level: EvidenceGrade
  markets: string[]
  conflicts: string[]
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const pct = (x: number) => `${Math.round(x * 100)}%`
const fmt = (n: number) => n.toLocaleString("en-US")

function classifyRival(text: string): RivalCell["status"] {
  const t = text.toLowerCase()
  if (/not confirmed|unknown|unclear|no (general |reliable )?.*confirmed|could not be (confirmed|verified)/.test(t)) return "unknown"
  if (/not (offered|available)|no rear|none\b/.test(t)) return "not_offered"
  if (/standard/.test(t)) return "standard"
  if (/option|package|pack\b|available/.test(t)) return "option"
  return "offered"
}
const RIVAL_VALUE: Record<RivalCell["status"], number | null> = { standard: 1, offered: 0.75, option: 0.5, not_offered: 0, unknown: null }

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data as T
}

/** Everything the database knows about one car line, read once per run. */
export async function readSignals(vehicle: string) {
  const db = admin()
  const studyAttrs = [...new Set(FEATURES.flatMap((f) => [...f.studyUS, ...f.studyCNEU]))]
  const [coverage, sales, studyUS, studyCNEU, ext, research, sims, perFeature] = await Promise.all([
    db.rpc("feedback_coverage", { p_model: vehicle }),
    db.from("sales_volume").select("market, year, volume").eq("sheet", SALES_SHEET[vehicle]).eq("year", 2025),
    db.from("study_metric").select("market, model, attribute, metric, value, source_cell").eq("sheet", "US_2025").eq("metric", "top2box").in("attribute", studyAttrs),
    db.from("study_metric").select("market, model, attribute, metric, value, source_cell").eq("sheet", "CN_EU_2025").eq("metric", "mean").in("attribute", studyAttrs),
    db.from("external_finding").select("id, source_id, kind, vehicle, topic, subject, title, stance, quote, source_url, raw").in("kind", ["competitor_feature", "owner_quote", "trend"]).limit(2000),
    db.from("research_finding").select("id, run_id, vehicle, claim, quote, source_url, feature_id, stance, relation, about_kind").eq("vehicle", vehicle).not("feature_id", "is", null).order("created_at").limit(2000),
    db.from("simulation_run").select("id, question, feature_id, created_at, simulation_verdict(verdict)").eq("vehicle", vehicle).not("feature_id", "is", null).order("created_at", { ascending: false }).limit(200),
    Promise.all(
      FEATURES.map((f) =>
        db.rpc("requirement_feature_counts", { p_model: vehicle, p_level2: f.level2, p_pattern: f.pattern, p_europe: EUROPE })
      )
    ),
  ])

  const cov = must(coverage, "feedback_coverage") as { country: string | null; comments: number }[]
  const totalComments = cov.reduce((s, r) => s + Number(r.comments), 0)
  const countries = cov.map((r) => r.country).filter((c): c is string => Boolean(c))

  const salesRows = must(sales, "sales_volume") as { market: Bucket; volume: number }[]
  const salesTotal = salesRows.reduce((s, r) => s + r.volume, 0) || 1
  const salesShare = Object.fromEntries(BUCKETS.map((b) => [b, (salesRows.find((r) => r.market === b)?.volume ?? 0) / salesTotal])) as Record<Bucket, number>

  const counts = new Map<string, Counts>()
  FEATURES.forEach((f, i) => {
    const rows = must(perFeature[i], `counts ${f.id}`) as { sentiment: string; bucket: Bucket; comments: number }[]
    const zero = () => ({ EU: 0, US: 0, CN: 0, RoW: 0 })
    const c: Counts = { positive: 0, negative: 0, want: 0, byBucket: { positive: zero(), negative: zero(), want: zero() } }
    for (const r of rows) {
      const n = Number(r.comments)
      if (r.sentiment !== "positive" && r.sentiment !== "negative" && r.sentiment !== "want") continue
      c[r.sentiment] += n
      c.byBucket[r.sentiment][r.bucket] += n
    }
    counts.set(f.id, c)
  })

  type StudyRow = { market: string; model: string; attribute: string; metric: string; value: number | null; source_cell: string }
  const study = [...(must(studyUS, "study US") as StudyRow[]), ...(must(studyCNEU, "study CN/EU") as StudyRow[])].filter((r) => r.value !== null)

  type ExtRow = { id: string; source_id: string; kind: string; vehicle: string | null; topic: string | null; subject: string | null; title: string; stance: string | null; quote: string | null; source_url: string | null; raw: { competitor?: string; feature?: { source_url?: string } } }
  const extRows = must(ext, "external_finding") as ExtRow[]

  type ResRow = { id: string; run_id: string; claim: string; quote: string; source_url: string; feature_id: string; stance: string | null; relation: string | null; about_kind: string | null }
  const resRows = (must(research, "research_finding") as ResRow[]).filter((r) => r.about_kind === "bmw" || r.about_kind === null)

  type SimRow = { id: string; question: string; feature_id: string; created_at: string; simulation_verdict: { verdict: string }[] }
  const simRows = must(sims, "simulation_run") as SimRow[]

  return { vehicle, totalComments, countries, salesShare, counts, study, extRows, resRows, simRows }
}

export type Signals = Awaited<ReturnType<typeof readSignals>>

function studyPairs(sig: Signals, f: Feature): StudyPair[] {
  const own = STUDY_OWN[sig.vehicle] ?? {}
  const out: StudyPair[] = []
  for (const market of ["US", "EU", "China"] as const) {
    const ownModel = own[market]
    if (!ownModel) continue
    const attrs = market === "US" ? f.studyUS : f.studyCNEU
    for (const a of attrs) {
      const rows = sig.study.filter((r) => r.market === market && r.attribute === a)
      const mine = rows.find((r) => r.model === ownModel)
      const others = rows.filter((r) => r.model !== ownModel)
      if (!mine || !others.length) continue
      const best = others.reduce((b, r) => ((r.value ?? 0) > (b.value ?? 0) ? r : b))
      out.push({ market, attribute: a, metric: mine.metric, own: mine.value!, best: best.value!, bestModel: best.model, cell: mine.source_cell, ownModel })
    }
  }
  return out
}

function kindFor(c: Counts): ReqKind | null {
  const pw = c.negative + c.want
  if (c.positive >= CANDIDATE_RULE.minPraise && c.positive > CANDIDATE_RULE.praiseOverPain * pw) return "protect"
  if (pw < CANDIDATE_RULE.minPainOrWant) return null
  return c.want >= CANDIDATE_RULE.addWhenWantsAtLeast * c.negative ? "add" : "fix"
}

const studyLabel = (p: StudyPair) =>
  `${p.market === "China" ? "China" : p.market} · ${p.attribute.trim()}: ${p.ownModel.replace("BMW ", "")} ${p.metric === "top2box" ? pct(p.own) : p.own.toFixed(2)} vs ${p.bestModel.replace("BMW ", "")} ${p.metric === "top2box" ? pct(p.best) : p.best.toFixed(2)}`

/** Candidates with factors, score, evidence level and code-detected conflicts. */
export function buildCandidates(sig: Signals, opts: GenerateOptions, weights: Record<FactorId, number>): Candidate[] {
  const kinds = new Map(FEATURES.map((f) => [f.id, kindFor(sig.counts.get(f.id)!)]))
  const maxPW = Math.max(1, ...FEATURES.map((f) => sig.counts.get(f.id)!.negative + sig.counts.get(f.id)!.want))
  const maxPos = Math.max(1, ...FEATURES.map((f) => sig.counts.get(f.id)!.positive))

  const out: Candidate[] = []
  for (const feature of FEATURES) {
    const kind = kinds.get(feature.id)
    if (!kind) continue
    const c = sig.counts.get(feature.id)!
    const pw = c.negative + c.want
    const signal = kind === "protect" ? c.positive : pw
    const factors: Factor[] = []
    const conflicts: string[] = []
    const add = (id: FactorId, value: number | null, detail: string, applies = true) => {
      const included = applies && value !== null
      factors.push({ id, label: FACTORS[id].label, value: value === null ? null : Math.round(value * 100) / 100, weight: included ? weights[id] : 0, included, detail, source: FACTORS[id].source })
    }

    // 1. Customer voice (BMW feedback)
    add(
      "customer_voice",
      kind === "protect" ? c.positive / maxPos : pw / maxPW,
      kind === "protect"
        ? `${fmt(c.positive)} customers praise it (${fmt(c.negative)} complaints, ${fmt(c.want)} wishes) of ${fmt(sig.totalComments)} comments`
        : `${fmt(c.negative)} complaints + ${fmt(c.want)} wishes of ${fmt(sig.totalComments)} comments (${fmt(c.positive)} praise it)`
    )

    // 2. Customer study vs the best BMW sibling in the same slice
    const study = studyPairs(sig, feature)
    if (study.length) {
      const rel = study.map((p) => p.own / Math.max(p.own, p.best))
      const avgGap = 1 - rel.reduce((s, x) => s + x, 0) / rel.length
      const leads = study.filter((p) => p.own >= p.best).length
      const value = kind === "protect" ? leads / study.length : clamp01(avgGap / 0.2)
      const telling = [...study].sort((a, b) => (kind === "protect" ? b.own / b.best - a.own / a.best : a.own / a.best - b.own / b.best)).slice(0, 2)
      add("satisfaction", value, `${telling.map(studyLabel).join("; ")}${study.length > 2 ? `; ${study.length} study measures in total` : ""}`)
      if (kind !== "protect" && avgGap < 0.02) conflicts.push(`The customer study shows almost no gap overall (${study.length} measures); the largest is ${studyLabel(telling[0])}.`)
      if (kind === "protect" && leads === 0) conflicts.push(`The customer study does not show a lead: ${studyLabel(telling[0])}.`)
    } else add("satisfaction", null, "No matching customer-study question for this car line")

    // 3. Market reach: sales share of the markets where the signal shows (feedback in the same direction,
    //    or a study measure pointing the same way: a gap of 3%+ for fix/add, a lead for protect)
    const inBucket = (b: Bucket) => (kind === "protect" ? c.byBucket.positive[b] : c.byBucket.negative[b] + c.byBucket.want[b])
    const sigBuckets = BUCKETS.filter((b) => inBucket(b) >= 3)
    const studyMarkets = new Set(
      study.filter((p) => (kind === "protect" ? p.own >= p.best : p.own < 0.97 * p.best)).map((p) => (p.market === "China" ? "CN" : p.market)) as Bucket[]
    )
    const markets = BUCKETS.filter((b) => sigBuckets.includes(b) || studyMarkets.has(b))
    const reach = markets.reduce((s, b) => s + sig.salesShare[b], 0)
    add("market_reach", reach, markets.length ? `Signal in ${markets.map((b) => BUCKET_NAME[b]).join(", ")}: ${pct(reach)} of 2025 sales` : "No market with 3+ comments or a study measure")
    // The US-heavy feedback is a car-line blind spot, shown once on the board (coverage), not on every requirement.

    // 4. Rival offer (verified public rival tables)
    const rivals: RivalCell[] = sig.extRows
      .filter((r) => r.kind === "competitor_feature" && r.vehicle === sig.vehicle && r.topic && RIVAL_TOPIC[r.topic] === feature.id)
      .map((r) => ({ id: r.id, topic: r.topic!, rival: r.raw?.competitor ?? r.subject ?? "", value: r.title, status: classifyRival(r.title), url: r.raw?.feature?.source_url ?? r.source_url }))
    const presence = rivals.filter((r) => RIVAL_PRESENCE.has(r.topic))
    const known = presence.filter((r) => RIVAL_VALUE[r.status] !== null)
    if (opts.public && known.length) {
      const v = known.reduce((s, r) => s + (RIVAL_VALUE[r.status] ?? 0), 0) / known.length
      const n = (s: RivalCell["status"]) => known.filter((r) => r.status === s).length
      add("competitor", v, `${known.length} rival offers known: ${n("standard")} standard, ${n("option")} option, ${n("offered")} offered, ${n("not_offered")} not offered; ${presence.length - known.length} not confirmed`)
    } else add("competitor", null, opts.public ? "Rival tables do not say who offers this feature" : "Public data switched off for this run", opts.public)

    // 5. Outside voices pointing the same way (public quotes, industry studies, research findings)
    const dirOk = (stance: string | null) => (kind === "protect" ? stance === "positive" : stance === "negative" || stance === "request" || stance === "mixed")
    const publicItems: PublicItem[] = !opts.public
      ? []
      : sig.extRows
          .filter((r) => (r.kind === "owner_quote" && r.vehicle === sig.vehicle && r.topic && QUOTE_TOPIC[r.topic] === feature.id) || (r.kind === "trend" && r.topic && TREND_PROBLEM_TOPIC[r.topic] === feature.id))
          .map((r) => ({
            id: r.id,
            kind: r.kind as PublicItem["kind"],
            channel: r.kind === "trend" ? "Industry studies" : QUOTE_CHANNEL(r.source_id),
            title: r.title,
            quote: r.quote,
            stance: r.stance,
            url: r.source_url,
            agrees: r.kind === "trend" ? kind !== "protect" : dirOk(r.stance),
          }))
    const research: ResearchItem[] = !opts.research
      ? []
      : sig.resRows
          .filter((r) => r.feature_id === feature.id)
          .map((r) => ({ id: r.id, channel: RESEARCH_CHANNEL(r.source_url), claim: r.claim, quote: r.quote, url: r.source_url, stance: r.stance, relation: r.relation, run_id: r.run_id }))
    const channels = new Set([
      ...publicItems.filter((p) => p.agrees).map((p) => p.channel),
      ...research.filter((r) => r.relation === "agrees" && dirOk(r.stance === "neutral" ? null : r.stance)).map((r) => r.channel),
    ])
    const contradicts = research.filter((r) => r.relation === "contradicts").length
    if (contradicts) conflicts.push(`${contradicts} outside finding${contradicts > 1 ? "s" : ""} contradict${contradicts > 1 ? "" : "s"} BMW's customers on this feature.`)
    if (opts.public || opts.research)
      add("outside_voice", clamp01(channels.size / 4), channels.size ? `${channels.size} independent channel${channels.size > 1 ? "s agree" : " agrees"}: ${[...channels].join(", ")}` : `No outside channel found yet (${publicItems.length + research.length} items checked)`)
    else add("outside_voice", null, "Public data and research switched off for this run", false)

    // 6. Simulated segment reaction (What-If, 5 Series only, fix/add only)
    let sim: SimSummary | null = null
    const simRun = sig.simRows.find((r) => r.feature_id === feature.id)
    if (opts.whatif && simRun && kind !== "protect") {
      const counts: Record<string, number> = {}
      for (const v of simRun.simulation_verdict) counts[v.verdict] = (counts[v.verdict] ?? 0) + 1
      const called = simRun.simulation_verdict.filter((v) => v.verdict !== "not_enough_evidence").length
      sim = { run_id: simRun.id, question: simRun.question, created_at: simRun.created_at, counts, called }
      const net = called
        ? ((counts.more_likely ?? 0) + 0.5 * (counts.slightly_more_likely ?? 0) - (counts.less_likely ?? 0) - 0.5 * (counts.slightly_less_likely ?? 0)) / called
        : 0
      const more = (counts.more_likely ?? 0) + (counts.slightly_more_likely ?? 0)
      const less = (counts.less_likely ?? 0) + (counts.slightly_less_likely ?? 0)
      add("simulated", called ? (net + 1) / 2 : null, `Latest What-If "${simRun.question}": ${more} more likely, ${counts.no_effect ?? 0} no effect, ${less} less likely, ${counts.not_enough_evidence ?? 0} not enough evidence`)
      if (less >= 2) conflicts.push(`${less} of 9 simulated segments would be less likely to buy (What-If, simulated).`)
    } else
      add(
        "simulated",
        null,
        !opts.whatif ? "What-If switched off for this run" : sig.vehicle !== "G60" ? "Customer segments exist for the 5 Series only" : kind === "protect" ? "Not used for 'protect'" : "No What-If run on this feature yet",
        opts.whatif && sig.vehicle === "G60" && kind !== "protect"
      )

    // Mixed internal signal
    if (kind !== "protect" && c.positive >= 10 && c.positive >= 0.5 * pw) conflicts.push(`Mixed signal: ${fmt(c.positive)} customers praise this feature while ${fmt(pw)} complain or ask for more.`)
    if (kind === "protect" && pw >= 0.25 * c.positive) conflicts.push(`Not uncontested: ${fmt(pw)} complaints or wishes alongside ${fmt(c.positive)} praise.`)

    const used = factors.filter((f) => f.included && f.value !== null)
    const wsum = used.reduce((s, f) => s + f.weight, 0)
    const score = wsum ? Math.round((used.reduce((s, f) => s + f.weight * (f.value ?? 0), 0) / wsum) * 100) : 0
    const hasStudy = study.length > 0
    const hasOutside = channels.size > 0
    const evidence_level: EvidenceGrade =
      signal >= 30 && hasStudy && hasOutside ? "A" : signal >= 15 && (hasStudy || hasOutside) ? "B" : signal >= 5 ? "C" : "D"

    out.push({ feature, kind, counts: c, study, rivals, publicItems, research, sim, factors, score, priority: priorityOf(score), evidence_level, markets, conflicts })
  }
  return out.sort((a, b) => b.score - a.score || a.feature.id.localeCompare(b.feature.id))
}
