// Research Agent (ARCHITECTURE.md §7). One run:
//  1. The model plans a few web searches for the PM's question (it never browses itself).
//  2. Linkup runs them and returns page text. Nothing else is read.
//  3. The model extracts findings from that text, each with a verbatim quote and the page it came from.
//  4. The server keeps a finding only if its quote is really in that page's text; the rest is logged as dropped.
//  5. The server, not the model, relates each finding to BMW's own feedback counts for the same feature.
//  6. The run, every query, every page shown to the model and every finding are stored (History).
import { createClient } from "@supabase/supabase-js"

import { SOCIAL_DOMAINS } from "@/lib/channels"
import { FEATURES, featureOf } from "@/lib/features"
import { llm, MODEL } from "@/lib/simulate"

export const RESEARCH_PROMPT_VERSION = "research-v3"

// social: which searches go to social media and owner forums. "all" = every search, "some" = at least one
// (standard/deep), "none" = never.
export const MISSIONS = {
  owners: { label: "Social and owner voices", hint: "owners and drivers in their own words on Reddit, X, TikTok, Facebook, YouTube and car forums", social: "all" },
  competitors: { label: "Competitor comparison", hint: "rival models' specs, equipment, prices, and what their owners say", social: "some" },
  reviews: { label: "Reviews and press", hint: "professional car reviews and motoring press", social: "some" },
  trends: { label: "Trends", hint: "industry studies, surveys and market data about premium sedan and EV buyers", social: "none" },
  free: { label: "Free question", hint: "whatever best answers the question", social: "some" },
} as const
export type MissionId = keyof typeof MISSIONS

export const DEPTHS = {
  quick: { label: "Quick", queries: 1, linkup: "fast" },
  standard: { label: "Standard", queries: 3, linkup: "standard" },
  deep: { label: "Deep", queries: 4, linkup: "deep" },
} as const
export type DepthId = keyof typeof DEPTHS

const PER_QUERY = 5
const MAX_SOURCES = 15
const PAGE_CHARS = 2500
const MAX_FINDINGS = 10
// Current generation per car line: named in the searches, and social posts before its launch are about the old car.
const GENERATION: Record<string, { note: string; since: string }> = {
  G60: { note: "The current 5 Series is the G60 generation; the electric version is the i5.", since: "2023-06-01" },
  G70: { note: "The current 7 Series is the G70 generation; the electric version is the i7.", since: "2022-04-01" },
  F70: { note: "The current 1 Series is the F70 generation.", since: "2024-09-01" },
}

const SOURCE_TYPES = ["official_spec", "press", "review", "forum_post", "analysis", "other"] as const
const STANCES = ["positive", "negative", "mixed", "neutral"] as const
const MARKETS = ["US", "EU", "CN", "KR", "JP", "global"] as const

export type Query = { q: string; channel: "social" | "web"; depth: string; include_domains: string[] | null; results: number; seconds: number; error?: string }
export type Source = { sid: string; url: string; name: string }
export type Dropped = { source_id: string; quote: string; claim: string; reason: string }
export type BmwContext = { positive: number; negative: number; want: number; total: number }
export type ResearchFinding = {
  id: string
  claim: string
  quote: string
  source_url: string
  source_name: string | null
  source_type: string | null
  published_date: string | null
  market: string | null
  feature_id: string | null
  stance: string | null
  about_kind: "bmw" | "competitor" | "market" | null
  about: string | null
  relation: "agrees" | "contradicts" | "new_signal" | "context" | null
  bmw_context: BmwContext | null
}
export type ResearchRun = {
  id: string
  created_at: string
  vehicle: string
  mission: string
  depth: string
  question: string
  queries: Query[]
  sources: Source[]
  dropped: Dropped[]
  model: string
  prompt_version: string
  linkup_calls: number
  duration_ms: number | null
  findings: ResearchFinding[]
}

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// ---------- 1. Plan the searches ----------
async function planQueries(question: string, mission: MissionId, n: number, vehicle: string, vehicleName: string): Promise<{ q: string; channel: "social" | "web" }[]> {
  const m = MISSIONS[mission]
  const socialRule =
    m.social === "all"
      ? `Every query is "social": it looks for owners' and drivers' own words.`
      : m.social === "none"
        ? `Every query is "web".`
        : `At least one query must be "social" (owners' own words) unless only one query is allowed; use more social queries when the question is about what customers, owners or users say, like or complain about.`
  const out = await llm<{ queries: { q: string; channel: "social" | "web" }[] }>(
    `You plan web searches for a BMW product manager who is defining the successor of the ${vehicleName} (on sale around 2030). ` +
      `Mission: ${m.label} (${m.hint}).\n` +
      `Write exactly ${n} search ${n === 1 ? "query" : "queries"} that together answer the PM's question. Each query has a channel:\n` +
      `- "social": searched only on Reddit, X, TikTok, Facebook, YouTube, BMW/Mercedes/Audi owner forums and Chinese car communities. Phrase it the way owners talk ("i5 owners complain about...", "anyone else hate the touchscreen climate...").\n` +
      `- "web": press, professional reviews, carmaker sites, studies.\n` +
      `${socialRule}\n` +
      `Rules:\n- Each query is a specific natural-language search of 8 to 20 words.\n` +
      `- Name the cars, the feature and the market when they matter. ${GENERATION[vehicle]?.note ?? ""}\n` +
      `- Each query covers a different angle. No two queries may ask the same thing.\n- Do not answer the question.`,
    question,
    "plan",
    {
      type: "object",
      additionalProperties: false,
      required: ["queries"],
      properties: {
        queries: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["q", "channel"],
            properties: { q: { type: "string" }, channel: { type: "string", enum: ["social", "web"] } },
          },
        },
      },
    },
    "low"
  )
  const qs = out.queries.map((x) => ({ q: x.q.trim(), channel: x.channel })).filter((x) => x.q).slice(0, n)
  // The mission's social rule is enforced here too, not left to the model.
  if (m.social === "all") qs.forEach((x) => (x.channel = "social"))
  if (m.social === "none") qs.forEach((x) => (x.channel = "web"))
  if (m.social === "some" && n > 1 && !qs.some((x) => x.channel === "social") && qs.length) qs[qs.length - 1].channel = "social"
  return qs
}

// ---------- 2. Search with Linkup (page text comes back with each result) ----------
type Page = { url: string; name: string; content: string }

async function linkup(q: string, channel: "social" | "web", depth: string, fromDate: string | null): Promise<{ pages: Page[]; query: Query }> {
  const t0 = Date.now()
  const includeDomains = channel === "social" ? SOCIAL_DOMAINS : null
  const body: Record<string, unknown> = { q, depth, outputType: "searchResults", maxResults: PER_QUERY }
  if (includeDomains) body.includeDomains = includeDomains
  if (fromDate) body.fromDate = fromDate
  const query: Query = { q, channel, depth, include_domains: includeDomains, results: 0, seconds: 0 }
  try {
    const res = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LINKUP_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Linkup ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { results?: { type?: string; name?: string; url?: string; content?: string }[] }
    const pages = (data.results ?? [])
      .filter((r) => r.type !== "image" && r.url && r.content)
      .map((r) => ({ url: r.url!, name: r.name ?? r.url!, content: r.content! }))
    return { pages, query: { ...query, results: pages.length, seconds: (Date.now() - t0) / 1000 } }
  } catch (e) {
    return { pages: [], query: { ...query, seconds: (Date.now() - t0) / 1000, error: e instanceof Error ? e.message : String(e) } }
  }
}

// ---------- 3. Extract findings from the page text only ----------
type RawFinding = {
  source_id: string
  claim: string
  quote: string
  source_type: (typeof SOURCE_TYPES)[number]
  published_date: string | null
  market: (typeof MARKETS)[number] | null
  feature_id: string | null
  stance: (typeof STANCES)[number]
  about_kind: "bmw" | "competitor" | "market"
  about: string
}

async function extract(question: string, mission: MissionId, sources: (Source & { content: string })[], vehicleName: string): Promise<RawFinding[]> {
  const features = FEATURES.map((f) => `- ${f.id}: ${f.name}. ${f.description}`).join("\n")
  const pages = sources.map((s) => `[${s.sid}] ${s.name}\n${s.url}\n${s.content}`).join("\n\n---\n\n")
  const out = await llm<{ findings: RawFinding[] }>(
    `You are a careful research analyst for BMW product management, working on the successor of the ${vehicleName}. ` +
      `You get web pages returned by a search engine, each with an ID like [S3]. Extract findings that help answer the PM's question.\n` +
      `A finding is one claim made by ONE page, proven by a quote from that page.\n` +
      `Rules:\n` +
      `- quote: copy one or two consecutive sentences EXACTLY as they appear in that page's text, character for character, max 300 characters. ` +
      `Do not fix typos, do not join separate passages, do not add or remove words, no ellipses. The server rejects any quote it cannot find in the page.\n` +
      `- claim: one plain sentence stating what the page says. Nothing that is not in the quote: no extra numbers, names or facts.\n` +
      `- Only what the page itself says. Never add your own knowledge. Opinions stay opinions ("an owner says...", "the reviewer finds...").\n` +
      `- feature_id: the ONE feature from the list below that the finding is about, or null if none fits.\n` +
      `- about_kind and about: WHOSE car the claim is about. "bmw" if it is about the BMW ${vehicleName} (any generation, including its electric version); about = "BMW ${vehicleName}". ` +
      `"competitor" if it is about another brand's car; about = brand and model, e.g. "Mercedes-Benz E-Class". "market" if it is about buyers, a segment or the industry in general; about = a 2 to 4 word label.\n` +
      `- stance: the opinion or experience the page expresses about that feature: positive (an owner or reviewer likes it, it works well), negative (complaint, problem, something missing), mixed (both). ` +
      `Use neutral for facts without an opinion: specs, equipment lists, prices, or a rival offering a feature, even when the fact sounds favourable.\n` +
      `- source_type: official_spec (the carmaker's own site), press (news), review (professional test), forum_post (owners on forums or social media), analysis (studies, surveys, consultancies), other.\n` +
      `- published_date: only if the page text states a date (YYYY-MM-DD or YYYY-MM), else null. market: only if the page is clearly about one market, else null.\n` +
      `- Skip pages that do not help, skip duplicates. At most ${MAX_FINDINGS} findings, most useful first. Few good findings beat many weak ones; an empty list is a valid answer.\n\n` +
      `Features:\n${features}`,
    `PM's question: ${question}\nMission: ${MISSIONS[mission].label}\n\nPAGES\n\n${pages}`,
    "findings",
    {
      type: "object",
      additionalProperties: false,
      required: ["findings"],
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["source_id", "claim", "quote", "source_type", "published_date", "market", "feature_id", "stance", "about_kind", "about"],
            properties: {
              source_id: { type: "string" },
              claim: { type: "string" },
              quote: { type: "string" },
              source_type: { type: "string", enum: [...SOURCE_TYPES] },
              published_date: { type: ["string", "null"] },
              market: { type: ["string", "null"], enum: [...MARKETS, null] },
              feature_id: { type: ["string", "null"], enum: [...FEATURES.map((f) => f.id), null] },
              stance: { type: "string", enum: [...STANCES] },
              about_kind: { type: "string", enum: ["bmw", "competitor", "market"] },
              about: { type: "string" },
            },
          },
        },
      },
    }
  )
  return out.findings.slice(0, MAX_FINDINGS)
}

// ---------- 4. The quote check ----------
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032`]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim()
const trimEllipsis = (q: string) => q.trim().replace(/^(\.\.\.|\u2026)\s*/, "").replace(/\s*(\.\.\.|\u2026)$/, "")

// ---------- 5. Relation to BMW's own feedback (a fixed rule, not the model) ----------
async function bmwCounts(featureId: string, vehicle: string, countries: string[]): Promise<BmwContext> {
  const f = featureOf(featureId)
  if (!f) return { positive: 0, negative: 0, want: 0, total: 0 }
  const { data, error } = await admin().rpc("evidence_comments", {
    p_model: vehicle,
    p_countries: countries,
    p_engines: null,
    p_level2: f.level2,
    p_pattern: f.pattern,
    p_per_sentiment: 1,
  })
  if (error) throw new Error(error.message)
  const c: BmwContext = { positive: 0, negative: 0, want: 0, total: 0 }
  for (const r of (data ?? []) as { sentiment: string; total_in_sentiment: number }[]) {
    const n = Number(r.total_in_sentiment)
    if (r.sentiment === "positive" || r.sentiment === "negative" || r.sentiment === "want") c[r.sentiment] = n
    c.total += n
  }
  return c
}

// Fewer than 5 BMW comments on the feature: new signal. Otherwise: does a real share (>= 20%) of BMW's own
// comments on this feature point the same way? Praise for a positive finding; complaints + wishes for a
// negative one. Yes: agrees. No: contradicts. Neutral or mixed findings (facts, specs, prices) are context.
// The counts are stored with the finding and shown in the UI, so anyone can check the label.
function relate(stance: string, c: BmwContext): ResearchFinding["relation"] {
  if (c.total < 5) return "new_signal"
  if (stance !== "positive" && stance !== "negative") return "context"
  const same = stance === "positive" ? c.positive : c.negative + c.want
  return same / c.total >= 0.2 ? "agrees" : "contradicts"
}

// ---------- The whole run ----------
export async function runResearch(input: { vehicle: string; vehicleName: string; mission: MissionId; depth: DepthId; question: string }): Promise<ResearchRun> {
  const t0 = Date.now()
  const db = admin()
  const m = MISSIONS[input.mission]
  const d = DEPTHS[input.depth]
  // Social posts and reviews from before the current generation's launch are about the old car.
  const since = (channel: "social" | "web") => (channel === "social" || input.mission === "reviews" ? GENERATION[input.vehicle]?.since ?? null : null)

  const planned = await planQueries(input.question, input.mission, d.queries, input.vehicle, input.vehicleName)
  const searched = await Promise.all(planned.map((p) => linkup(p.q, p.channel, d.linkup, since(p.channel))))

  // Every page the model will see gets an ID; duplicates by URL are dropped. Social pages go first so the
  // page cap never cuts owners' voices.
  const seen = new Set<string>()
  const pages: (Source & { content: string })[] = []
  const ordered = [...searched].sort((a, b) => (a.query.channel === "social" ? 0 : 1) - (b.query.channel === "social" ? 0 : 1))
  for (const { pages: ps } of ordered)
    for (const p of ps) {
      if (seen.has(p.url) || pages.length >= MAX_SOURCES) continue
      seen.add(p.url)
      pages.push({ sid: `S${pages.length + 1}`, url: p.url, name: p.name, content: p.content.slice(0, PAGE_CHARS) })
    }

  const raw = pages.length ? await extract(input.question, input.mission, pages, input.vehicleName) : []
  const bySid = new Map(pages.map((p) => [p.sid, p]))
  const dropped: Dropped[] = []
  const kept: RawFinding[] = []
  for (const f of raw) {
    const page = bySid.get(f.source_id)
    const quote = trimEllipsis(f.quote)
    const reason = !page
      ? "the page ID was not one of the pages shown"
      : quote.length < 20
        ? "quote too short to check"
        : !norm(page.content).includes(norm(quote))
          ? "quote not found in the page text"
          : null
    if (reason) dropped.push({ source_id: f.source_id, quote: f.quote, claim: f.claim, reason })
    else kept.push({ ...f, quote })
  }

  const coverage = await db.rpc("feedback_coverage", { p_model: input.vehicle })
  if (coverage.error) throw new Error(coverage.error.message)
  const countries = ((coverage.data ?? []) as { country: string }[]).map((r) => r.country)
  const featureIds = [...new Set(kept.map((f) => f.feature_id).filter((x): x is string => !!x))]
  const counts = new Map(await Promise.all(featureIds.map(async (id) => [id, await bmwCounts(id, input.vehicle, countries)] as const)))

  const ins = await db
    .from("research_run")
    .insert({
      vehicle: input.vehicle,
      mission: input.mission,
      depth: input.depth,
      question: input.question,
      queries: searched.map((s) => s.query),
      sources: pages.map(({ sid, url, name }) => ({ sid, url, name })),
      dropped,
      model: MODEL,
      prompt_version: RESEARCH_PROMPT_VERSION,
      linkup_calls: planned.length,
      duration_ms: Date.now() - t0,
    })
    .select()
    .single()
  if (ins.error) throw new Error(ins.error.message)

  const rows = kept.map((f) => {
    const page = bySid.get(f.source_id)!
    const ctx = f.feature_id ? counts.get(f.feature_id) ?? null : null
    return {
      run_id: ins.data.id,
      vehicle: input.vehicle,
      claim: f.claim,
      quote: f.quote,
      source_url: page.url,
      source_name: page.name,
      source_type: f.source_type,
      published_date: f.published_date,
      market: f.market,
      feature_id: f.feature_id,
      stance: f.stance,
      about_kind: f.about_kind,
      about: f.about,
      // Only a claim about the BMW itself can agree or disagree with BMW's own customers.
      relation: ctx && f.about_kind === "bmw" ? relate(f.source_type === "official_spec" ? "neutral" : f.stance, ctx) : null,
      bmw_context: ctx,
    }
  })
  let findings: ResearchFinding[] = []
  if (rows.length) {
    const r = await db.from("research_finding").insert(rows).select()
    if (r.error) throw new Error(r.error.message)
    findings = r.data as ResearchFinding[]
  }
  return { ...(ins.data as Omit<ResearchRun, "findings">), findings }
}

export async function loadResearchRun(id: string): Promise<ResearchRun | null> {
  const db = admin()
  const [run, findings] = await Promise.all([
    db.from("research_run").select("*").eq("id", id).maybeSingle(),
    db.from("research_finding").select("*").eq("run_id", id).order("created_at"),
  ])
  if (run.error || !run.data) return null
  return { ...(run.data as Omit<ResearchRun, "findings">), findings: (findings.data ?? []) as ResearchFinding[] }
}
