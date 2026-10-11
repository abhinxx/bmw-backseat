// Research Agent (ARCHITECTURE.md §7). One run:
//  1. The model plans a few web searches for the PM's question (it never browses itself). It gets context:
//     this car line's rivals (from our rival table), BMW's own top complaint themes, the 16 features.
//  2. Linkup runs them and returns page text. Social searches each target ONE platform. Nothing else is read.
//  3. The model extracts findings from that text, each with a verbatim quote and the page it came from.
//  4. The server keeps a finding only if its quote is really in that page's text; the rest is logged as dropped.
//  5. Fewer than 5 findings: one follow-up round on social platforms not searched yet.
//  6. The server, not the model, relates each finding to BMW's own feedback counts for the same feature.
//  7. The run, every query, every page shown to the model and every finding are stored (History).
import { createClient } from "@supabase/supabase-js"

import { PLATFORM_ORDER, PLATFORMS, type PlatformId } from "@/lib/channels"
import { FEATURES, featureOf } from "@/lib/features"
import { llm, MODEL } from "@/lib/simulate"

export const RESEARCH_PROMPT_VERSION = "research-v4"

// "Focus" in the UI. It only steers the planner: every run mixes owners' own words with press and web,
// except "owners", which searches social platforms only. Ids stay stable (they are stored with each run).
export const MISSIONS = {
  free: { label: "Open question", hint: "whatever best answers the question", social: "some" },
  owners: { label: "Owner voices", hint: "owners and drivers in their own words, across Reddit, owner forums, X, YouTube/TikTok and Chinese car communities", social: "all" },
  competitors: { label: "Competitors", hint: "how rival models compare: specs, equipment, prices, and what their owners say", social: "some" },
  reviews: { label: "Press and reviews", hint: "professional reviews and motoring press, checked against what owners say", social: "some" },
  trends: { label: "Market trends", hint: "industry studies, surveys and market data, plus what buyers say", social: "some" },
} as const
export type MissionId = keyof typeof MISSIONS

export const DEPTHS = {
  quick: { label: "Quick", queries: 1, linkup: "fast", hint: "1 search, about 15 s" },
  standard: { label: "Standard", queries: 3, linkup: "standard", hint: "3 searches, about 40 s" },
  deep: { label: "Deep", queries: 4, linkup: "deep", hint: "4 searches in Linkup's deep mode, about 60 to 90 s" },
} as const
export type DepthId = keyof typeof DEPTHS

const PER_QUERY = 6
const MAX_SOURCES = 24
const PAGE_CHARS = 2500
const MAX_FINDINGS = 12
const MIN_FINDINGS = 5
const FOLLOWUP_SEARCHES = 2
// Current generation per car line: named in the searches, and social posts before its launch are about the old car.
const GENERATION: Record<string, { note: string; since: string }> = {
  G60: { note: "The current 5 Series is the G60 generation; the electric version is the i5.", since: "2023-06-01" },
  G70: { note: "The current 7 Series is the G70 generation; the electric version is the i7.", since: "2022-04-01" },
  F70: { note: "The current 1 Series is the F70 generation.", since: "2024-09-01" },
}

const SOURCE_TYPES = ["official_spec", "press", "review", "forum_post", "analysis", "other"] as const
const STANCES = ["positive", "negative", "mixed", "neutral"] as const
const MARKETS = ["US", "EU", "CN", "KR", "JP", "global"] as const
const TARGETS = [...PLATFORM_ORDER, "web"] as const
type Target = (typeof TARGETS)[number]

export type Query = {
  q: string
  channel: "social" | "web"
  platform?: string | null
  followup?: boolean
  depth: string
  include_domains: string[] | null
  results: number
  seconds: number
  error?: string
}
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
  topic: string | null
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

// ---------- 0. Context for the planner and the reader, from our own database ----------
type Context = { rivals: string[]; complaints: string[]; wishes: string[] }

async function contextFor(vehicle: string): Promise<Context> {
  const db = admin()
  const [rivalRows, themes] = await Promise.all([
    db.from("external_finding").select("subject, raw").eq("source_id", `competitors_${vehicle.toLowerCase()}`).eq("kind", "competitor_feature"),
    db.rpc("feedback_themes", { p_model: vehicle, p_countries: null }),
  ])
  const rivals = [
    ...new Set(((rivalRows.data ?? []) as { subject: string; raw: { competitor?: string } | null }[]).map((r) => r.raw?.competitor ?? r.subject)),
  ]
  const rows = ((themes.data ?? []) as { level2: string; sentiment: string; comments: number }[]).map((t) => ({ ...t, comments: Number(t.comments) }))
  const top = (s: string, n: number) =>
    rows
      .filter((t) => t.sentiment === s)
      .sort((a, b) => b.comments - a.comments)
      .slice(0, n)
      .map((t) => `${t.level2} (${t.comments} comments)`)
  return { rivals, complaints: top("negative", 5), wishes: top("want", 3) }
}

// ---------- 1. Plan the searches ----------
type Planned = { q: string; channel: "social" | "web"; platform: PlatformId | null }

async function planQueries(question: string, mission: MissionId, n: number, vehicle: string, vehicleName: string, ctx: Context): Promise<Planned[]> {
  const m = MISSIONS[mission]
  const platforms = PLATFORM_ORDER.map((p) => `- "${p}": ${PLATFORMS[p].label} (${PLATFORMS[p].domains.join(", ")})`).join("\n")
  const mix =
    m.social === "all"
      ? `Every query is a social query, each on a DIFFERENT platform.`
      : n === 1
        ? `One query: target a social platform if the question is about what people say, like, complain about or experience; otherwise "web".`
        : `Mix sources: at least one "web" query (press, reviews, maker pages, studies) and at least one social query; social queries each on a DIFFERENT platform. Questions about feedback, complaints or experience deserve more social queries.`
  const out = await llm<{ queries: { q: string; target: Target }[] }>(
    `You plan web searches for a BMW product manager who is defining the successor of the BMW ${vehicleName} (on sale around 2030). ` +
      `A search engine (Linkup) runs each query and returns pages; another step reads them. You only write the queries.\n\n` +
      `Focus chosen by the PM: ${m.label} (${m.hint}).\n` +
      `Write exactly ${n} ${n === 1 ? "query" : "queries"}. Each query has a target: a social platform from this list, or "web":\n${platforms}\n- "web": press, professional reviews, carmaker sites, studies.\n` +
      `${mix}\n\n` +
      `Context from BMW's own data (use it to make queries specific, do not answer with it):\n` +
      `- ${GENERATION[vehicle]?.note ?? ""}\n` +
      `- Rivals of the ${vehicleName} in our comparison table: ${ctx.rivals.length ? ctx.rivals.join(", ") : "none recorded"}. When the PM says "competitors", "rivals" or "top N competitors" without naming them, use these, in this order.\n` +
      `- What BMW ${vehicleName} customers complain about most: ${ctx.complaints.join("; ") || "unknown"}. Most requested: ${ctx.wishes.join("; ") || "unknown"}.\n\n` +
      `Rules:\n` +
      `- Each query is one specific natural-language search of 8 to 20 words, naming the car(s), the topic and, if relevant, the market.\n` +
      `- Always write the brand with the model ("BMW i5", "BMW 5 Series G60", "Mercedes E-Class"): a bare "i5" or "5 Series" also finds other brands' cars (Hyundai Ioniq 5).\n` +
      `- Social queries are phrased the way owners write ("i5 owners, anyone else getting...", "G60 alignment pulling right after..."); web queries the way a reviewer or spec sheet would.\n` +
      `- When the question compares the BMW with rivals, give the BMW and the rivals separate queries rather than one query naming everything.\n` +
      `- "china" only when China or Chinese buyers matter for the question; "video" when the topic is visual or hands-on (controls, screens, space, sound).\n` +
      `- Different angles: no two queries may ask the same thing. Do not answer the question.`,
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
            required: ["q", "target"],
            properties: { q: { type: "string" }, target: { type: "string", enum: [...TARGETS] } },
          },
        },
      },
    },
    "low"
  )
  const qs: Planned[] = out.queries
    .map((x) => ({ q: x.q.trim(), channel: x.target === "web" ? ("web" as const) : ("social" as const), platform: x.target === "web" ? null : x.target }))
    .filter((x) => x.q)
    .slice(0, n)

  // The mix is enforced here too, not left to the model.
  if (m.social === "all") qs.forEach((x) => x.channel === "web" && Object.assign(x, { channel: "social", platform: null }))
  if (m.social === "some" && n > 1) {
    if (!qs.some((x) => x.channel === "social")) Object.assign(qs[qs.length - 1], { channel: "social", platform: null })
    if (!qs.some((x) => x.channel === "web")) Object.assign(qs[0], { channel: "web", platform: null })
  }
  // One platform per social query: fill missing or repeated platforms with the next unused one.
  const used = new Set<PlatformId>()
  for (const x of qs) {
    if (x.channel !== "social") continue
    if (!x.platform || used.has(x.platform)) x.platform = PLATFORM_ORDER.find((p) => !used.has(p)) ?? "reddit"
    used.add(x.platform)
  }
  return qs
}

// ---------- 2. Search with Linkup (page text comes back with each result) ----------
type Page = { url: string; name: string; content: string }

// Pages that never carry owner or press evidence: LinkedIn posts, ad case studies, platform blogs and trend reports.
const JUNK = /^https?:\/\/([^/]*\.)?(linkedin\.com|pinterest\.[a-z.]+|business\.reddit\.com|redditinc\.com|blog\.x\.com|blog\.youtube)\/|youtube\.com\/(trends|about|creators)\//i

async function linkup(p: Planned & { followup?: boolean }, depth: string, fromDate: string | null): Promise<{ pages: Page[]; query: Query }> {
  const t0 = Date.now()
  const includeDomains = p.channel === "social" && p.platform ? [...PLATFORMS[p.platform].domains] : null
  const body: Record<string, unknown> = { q: p.q, depth, outputType: "searchResults", maxResults: PER_QUERY }
  if (includeDomains) body.includeDomains = includeDomains
  if (fromDate) body.fromDate = fromDate
  const query: Query = {
    q: p.q,
    channel: p.channel,
    platform: p.platform,
    followup: p.followup,
    depth,
    include_domains: includeDomains,
    results: 0,
    seconds: 0,
  }
  try {
    const res = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LINKUP_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Linkup ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { results?: { type?: string; name?: string; url?: string; content?: string }[] }
    const pages = (data.results ?? [])
      .filter((r) => r.type !== "image" && r.url && r.content && !JUNK.test(r.url))
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
  topic: string
  stance: (typeof STANCES)[number]
  about_kind: "bmw" | "competitor" | "market"
  about: string
}

async function extract(
  question: string,
  mission: MissionId,
  sources: (Source & { content: string })[],
  vehicleName: string,
  ctx: Context,
  already: string[] = [],
  limit = MAX_FINDINGS
): Promise<RawFinding[]> {
  const features = FEATURES.map((f) => `- ${f.id}: ${f.name}. ${f.description}`).join("\n")
  const pages = sources.map((s) => `[${s.sid}] ${s.name}\n${s.url}\n${s.content}`).join("\n\n---\n\n")
  const out = await llm<{ findings: RawFinding[] }>(
    `You are a careful research analyst for BMW product management, working on the successor of the BMW ${vehicleName} (around 2030). ` +
      `You get pages returned by a search engine, each with an ID like [S3]. Extract the findings that answer the PM's question.\n` +
      `A finding is one claim made by ONE page, proven by a quote from that page.\n\n` +
      `What makes a good finding:\n` +
      `- It is on the question's topic, including closely related symptoms (for "alignment issues": pulling, off-centre steering wheel, uneven tyre wear, steering play). ` +
      `It is about a car the question names, a rival when the question asks about competitors, or the BMW ${vehicleName} itself: the PM's own car is ALWAYS in scope, its owners are "our users".\n` +
      `- Owners' own experiences are the most valuable; then professional reviews; then specs and prices. Read every page: an owner post on the topic is almost always worth a finding.\n` +
      `- Extract every finding that qualifies, up to ${limit}, at most two per page, owners' own words first. Fewer is fine when the pages do not support more; never pad.\n` +
      `- Skip: other topics; cars the question does not name, unless it asks about competitors, rivals or the market (a Hyundai Ioniq 5 post is not about the BMW i5); statements that something works fine unless the question asks about it; dealer or brand marketing; generic how-to content; posts about a much older generation unless the question asks; anything already listed under ALREADY FOUND.\n\n` +
      `Fields:\n` +
      `- quote: copy one or two consecutive sentences EXACTLY as they appear in that page's text, character for character, max 300 characters. ` +
      `Do not fix typos, do not join separate passages, do not add or remove words, no ellipses. The server rejects any quote it cannot find in the page.\n` +
      `- claim: one plain sentence stating what the page says, attributed ("An i5 owner says...", "The reviewer finds..."). Nothing that is not in the quote: no extra numbers, names or facts. Never add your own knowledge.\n` +
      `- topic: a 2 to 4 word label for what the finding is about, in plain words (e.g. "wheel alignment", "rear seat comfort").\n` +
      `- feature_id: the ONE feature from the list below that the finding is about, or null if none fits (then the topic carries it).\n` +
      `- about_kind and about: WHOSE car the claim is about. "bmw" if it is about the BMW ${vehicleName} (any generation, including its electric version); about = "BMW ${vehicleName}". ` +
      `"competitor" if it is about another brand's car; about = brand and model, e.g. "Mercedes-Benz E-Class" (our rivals for this car: ${ctx.rivals.join(", ") || "none recorded"}). "market" if it is about buyers, a segment or the industry in general; about = a 2 to 4 word label.\n` +
      `- stance: the opinion or experience the page expresses: positive (likes it, works well), negative (complaint, problem, something missing), mixed (both). ` +
      `Use neutral for facts without an opinion: specs, equipment lists, prices, or a rival offering a feature, even when the fact sounds favourable.\n` +
      `- source_type: official_spec (the carmaker's own site), press (news), review (professional test), forum_post (owners on forums or social media, including video comments), analysis (studies, surveys, consultancies), other.\n` +
      `- published_date: only if the page text states a date (YYYY-MM-DD or YYYY-MM), else null. market: only if the page is clearly about one market, else null.\n\n` +
      `Example. Question: "Do owners complain about road noise in the i5?" Page [S2] (a forum thread) contains: "Picked up my i5 last month. At 120 km/h the tyre roar is honestly louder than my old E-Class." ` +
      `Good finding: source_id "S2", quote "At 120 km/h the tyre roar is honestly louder than my old E-Class.", claim "An i5 owner says tyre noise at 120 km/h is louder than in their previous E-Class.", topic "tyre noise", about_kind "bmw", stance "negative", source_type "forum_post". ` +
      `Not a finding: the same thread's line "Dealer was super friendly" (off-topic).\n\n` +
      `Features:\n${features}`,
    `PM's question: ${question}\nFocus: ${MISSIONS[mission].label}\n` +
      (already.length ? `\nALREADY FOUND (do not repeat these claims):\n${already.map((c) => `- ${c}`).join("\n")}\n` : "") +
      `\nPAGES\n\n${pages}`,
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
            required: ["source_id", "claim", "quote", "source_type", "published_date", "market", "feature_id", "topic", "stance", "about_kind", "about"],
            properties: {
              source_id: { type: "string" },
              claim: { type: "string" },
              quote: { type: "string" },
              source_type: { type: "string", enum: [...SOURCE_TYPES] },
              published_date: { type: ["string", "null"] },
              market: { type: ["string", "null"], enum: [...MARKETS, null] },
              feature_id: { type: ["string", "null"], enum: [...FEATURES.map((f) => f.id), null] },
              topic: { type: "string" },
              stance: { type: "string", enum: [...STANCES] },
              about_kind: { type: "string", enum: ["bmw", "competitor", "market"] },
              about: { type: "string" },
            },
          },
        },
      },
    }
  )
  return out.findings.slice(0, limit)
}

// One long read of 24 pages yields far fewer findings than three reads of 8 (measured: 1 vs 3 on the same pages),
// so pages are read in parallel batches. Exact duplicate quotes are dropped by the quote check.
const BATCH = 8
const readPages = (question: string, mission: MissionId, pages: PageText[], vehicleName: string, ctx: Context, already: string[] = []) =>
  Promise.all(
    Array.from({ length: Math.ceil(pages.length / BATCH) }, (_, i) =>
      extract(question, mission, pages.slice(i * BATCH, (i + 1) * BATCH), vehicleName, ctx, already, 6)
    )
  ).then((r) => r.flat())

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
// Linkup page text can carry HTML entities (&#x27; &amp;). Decoded before the model sees it and before the quote check.
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

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
type PageText = Source & { content: string }

// Keeps a finding only when its page was shown and its quote is in that page's text; duplicates are dropped too.
function checkQuotes(raw: RawFinding[], bySid: Map<string, PageText>, kept: RawFinding[], dropped: Dropped[]) {
  const seenQuotes = new Set(kept.map((k) => norm(k.quote)))
  for (const f of raw) {
    const page = bySid.get(f.source_id)
    const quote = trimEllipsis(f.quote)
    const reason = !page
      ? "the page ID was not one of the pages shown"
      : quote.length < 20
        ? "quote too short to check"
        : !norm(page.content).includes(norm(quote))
          ? "quote not found in the page text"
          : seenQuotes.has(norm(quote))
            ? "duplicate of a finding already kept"
            : null
    if (reason) dropped.push({ source_id: f.source_id, quote: f.quote, claim: f.claim, reason })
    else {
      kept.push({ ...f, quote })
      seenQuotes.add(norm(quote))
    }
  }
}

export async function runResearch(input: { vehicle: string; vehicleName: string; mission: MissionId; depth: DepthId; question: string }): Promise<ResearchRun> {
  const t0 = Date.now()
  const db = admin()
  const d = DEPTHS[input.depth]
  // Social posts and reviews from before the current generation's launch are about the old car.
  const since = (channel: "social" | "web") => (channel === "social" || input.mission === "reviews" ? GENERATION[input.vehicle]?.since ?? null : null)

  const ctx = await contextFor(input.vehicle)
  const planned = await planQueries(input.question, input.mission, d.queries, input.vehicle, input.vehicleName, ctx)
  const searched = await Promise.all(planned.map((p) => linkup(p, d.linkup, since(p.channel))))

  // Every page the model will see gets an ID; duplicates by URL are dropped. Pages are interleaved across
  // searches (1st result of each search, then 2nd...), social first, so the page cap never silences a platform.
  const seen = new Set<string>()
  const pages: PageText[] = []
  const addPages = (results: { pages: Page[]; query: Query }[], cap: number) => {
    const ordered = [...results].sort((a, b) => (a.query.channel === "social" ? 0 : 1) - (b.query.channel === "social" ? 0 : 1))
    const added: PageText[] = []
    for (let i = 0; i < PER_QUERY; i++)
      for (const { pages: ps } of ordered) {
        const p = ps[i]
        if (!p || seen.has(p.url) || pages.length >= cap) continue
        seen.add(p.url)
        const page = { sid: `S${pages.length + 1}`, url: p.url, name: decode(p.name), content: decode(p.content).slice(0, PAGE_CHARS) }
        pages.push(page)
        added.push(page)
      }
    return added
  }
  addPages(searched, MAX_SOURCES)
  const bySid = new Map(pages.map((p) => [p.sid, p]))
  const dropped: Dropped[] = []
  const kept: RawFinding[] = []
  if (pages.length) checkQuotes(await readPages(input.question, input.mission, pages, input.vehicleName, ctx), bySid, kept, dropped)

  // Fewer than 5 findings: one more round on social platforms not searched yet, same question, new pages only.
  const followups: { pages: Page[]; query: Query }[] = []
  if (kept.length < MIN_FINDINGS && input.depth !== "quick") {
    const usedPlatforms = new Set(planned.map((p) => p.platform).filter(Boolean))
    const base = planned.find((p) => p.channel === "social")?.q ?? input.question
    const next = PLATFORM_ORDER.filter((p) => !usedPlatforms.has(p)).slice(0, FOLLOWUP_SEARCHES)
    followups.push(...(await Promise.all(next.map((platform) => linkup({ q: base, channel: "social", platform, followup: true }, d.linkup, since("social"))))))
    const fresh = addPages(followups, MAX_SOURCES + FOLLOWUP_SEARCHES * PER_QUERY)
    for (const p of fresh) bySid.set(p.sid, p)
    if (fresh.length)
      checkQuotes(
        await readPages(input.question, input.mission, fresh, input.vehicleName, ctx, kept.map((k) => k.claim)),
        bySid,
        kept,
        dropped
      )
  }
  // Owners' own words first, then the rest, capped.
  kept.sort((a, b) => Number(b.source_type === "forum_post") - Number(a.source_type === "forum_post"))
  kept.splice(MAX_FINDINGS)

  const coverage = await db.rpc("feedback_coverage", { p_model: input.vehicle })
  if (coverage.error) throw new Error(coverage.error.message)
  const countries = ((coverage.data ?? []) as { country: string }[]).map((r) => r.country)
  const featureIds = [...new Set(kept.map((f) => f.feature_id).filter((x): x is string => !!x))]
  const counts = new Map(await Promise.all(featureIds.map(async (id) => [id, await bmwCounts(id, input.vehicle, countries)] as const)))

  const allSearches = [...searched, ...followups]
  const ins = await db
    .from("research_run")
    .insert({
      vehicle: input.vehicle,
      mission: input.mission,
      depth: input.depth,
      question: input.question,
      queries: allSearches.map((s) => s.query),
      sources: pages.map(({ sid, url, name }) => ({ sid, url, name })),
      dropped,
      model: MODEL,
      prompt_version: RESEARCH_PROMPT_VERSION,
      linkup_calls: allSearches.length,
      duration_ms: Date.now() - t0,
    })
    .select()
    .single()
  if (ins.error) throw new Error(ins.error.message)

  const rows = kept.map((f) => {
    const page = bySid.get(f.source_id)!
    const bmw = f.feature_id ? counts.get(f.feature_id) ?? null : null
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
      topic: f.topic?.trim() || null,
      stance: f.stance,
      about_kind: f.about_kind,
      about: f.about,
      // Only a claim about the BMW itself can agree or disagree with BMW's own customers.
      relation: bmw && f.about_kind === "bmw" ? relate(f.source_type === "official_spec" ? "neutral" : f.stance, bmw) : null,
      bmw_context: bmw,
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
