import { createClient } from "@supabase/supabase-js"
import { EUROPE } from "./data"
import type { MarketId, VehicleId } from "./scope"

export type TopicQuote = { comment_id: string; text: string; country: string | null; source: string; sentiment: string; excel_row: number }

// Exact taxonomy matches, never keyword-expanded or AI-written. Only reads the existing snapshot.
export async function missionQuotes(vehicle: VehicleId, market: MarketId, themes: string[]) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const countries = market === "EU" ? EUROPE : market === "all" ? null : [market]
  const entries = await Promise.all([...new Set(themes)].map(async (theme) => {
    let query = db.from("feedback_label")
      .select("comment_id, sentiment, excel_row, feedback_comment!inner(text, country, source, model)")
      .eq("level2", theme).eq("feedback_comment.model", vehicle)
      .order("comment_id").limit(24)
    if (countries) query = query.in("feedback_comment.country", countries)
    const { data, error } = await query
    if (error) throw new Error(`Mission Control evidence: ${error.message}`)
    const seen = new Set<string>()
    const quotes: TopicQuote[] = []
    for (const row of data ?? []) {
      const comment = row.feedback_comment as unknown as { text: string; country: string | null; source: string }
      const key = `${row.comment_id}:${row.sentiment}`
      if (seen.has(key)) continue
      seen.add(key)
      quotes.push({ comment_id: row.comment_id, sentiment: row.sentiment, excel_row: row.excel_row, ...comment })
    }
    return [theme, quotes] as const
  }))
  return Object.fromEntries(entries)
}
