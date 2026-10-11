// Server-side reads from the internal snapshot. Every number shown in the app comes from here
// (database queries), never from a language model.
import { createClient } from "@supabase/supabase-js"

import type { MarketId, VehicleId } from "@/lib/scope"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export type Bucket = "EU" | "US" | "CN" | "RoW"
export const BUCKETS: { id: Bucket; name: string }[] = [
  { id: "EU", name: "Europe" },
  { id: "US", name: "United States" },
  { id: "CN", name: "China" },
  { id: "RoW", name: "Rest of world" },
]

// Country codes in the feedback, grouped into the brief's markets. Anything else is Rest of world.
export const EUROPE = ["GB", "SE", "DK", "FI", "NO", "FR", "LV", "ES", "DE", "IT", "NL", "BE", "CH", "AT", "PL", "PT", "IE"]
const bucketOf = (cc: string | null): Bucket =>
  cc === "US" ? "US" : cc === "CN" ? "CN" : cc && EUROPE.includes(cc) ? "EU" : "RoW"
const countriesFor = (m: MarketId) => (m === "EU" ? EUROPE : m === "US" ? ["US"] : m === "CN" ? ["CN"] : null)

const SALES_SHEET: Record<VehicleId, string> = { G60: "G60_G68", G70: "G70", F70: "F70" }
// Model names as written in the customer study (CN_EU_2025 sheet).
const STUDY_MODEL: Record<VehicleId, Partial<Record<"EU" | "CN", string>>> = {
  G60: { EU: "BMW 5 Series G60", CN: "BMW 5 Series G68" },
  G70: { EU: "BMW 7 Series G70", CN: "BMW 7 Series G70" },
  F70: { EU: "BMW 1 Series F70" },
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

export type ThemeRow = { level2: string; sentiment: "positive" | "negative" | "want"; comments: number }

export async function missionControl(v: VehicleId, m: MarketId) {
  const [sales, coverage, study, themes] = await Promise.all([
    db.from("sales_volume").select("market, year, volume, is_forecast").eq("sheet", SALES_SHEET[v]),
    db.rpc("feedback_coverage", { p_model: v }),
    db
      .from("study_metric")
      .select("market, model, value, source_cell")
      .eq("sheet", "CN_EU_2025")
      .eq("attribute", "Overall product satisfaction")
      .eq("metric", "mean"),
    db.rpc("feedback_themes", { p_model: v, p_countries: countriesFor(m) }),
  ])

  const salesRows = must(sales, "sales_volume") as { market: Bucket; year: number; volume: number }[]
  const salesBy = (year: number) =>
    Object.fromEntries(BUCKETS.map((b) => [b.id, salesRows.find((r) => r.market === b.id && r.year === year)?.volume ?? 0])) as Record<Bucket, number>

  const feedbackBy = Object.fromEntries(BUCKETS.map((b) => [b.id, 0])) as Record<Bucket, number>
  for (const r of must(coverage, "feedback_coverage") as { country: string | null; comments: number }[]) {
    feedbackBy[bucketOf(r.country)] += Number(r.comments)
  }

  const studyRows = must(study, "study_metric") as { market: string; model: string; value: number; source_cell: string }[]
  const satisfaction = (["EU", "CN"] as const).flatMap((mk) => {
    const row = studyRows.find((r) => r.market === (mk === "EU" ? "EU" : "China") && r.model === STUDY_MODEL[v][mk])
    return row ? [{ market: mk, value: row.value, cell: row.source_cell }] : []
  })

  return {
    sales2025: salesBy(2025),
    sales2030: salesBy(2030),
    feedbackBy,
    countryFeedback: must(coverage, "feedback_coverage") as { country: string | null; comments: number }[],
    satisfaction,
    themes: (must(themes, "feedback_themes") as ThemeRow[]).map((t) => ({ ...t, comments: Number(t.comments) })),
  }
}
