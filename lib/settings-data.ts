// Row counts for the Settings page: what is actually in the database right now.
// A missing table (not created yet, no permission) comes back as null and is shown as
// "not available yet" — the page never throws because a table is absent.
import { createClient } from "@supabase/supabase-js"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export const DATA_TABLES = [
  "feedback_comment",
  "feedback_label",
  "study_metric",
  "option_item",
  "vehicle_variant",
  "sales_volume",
  "persona",
  "persona_evidence",
  "external_source",
  "external_finding",
  "search_trend",
  "research_finding",
  "research_run",
  "simulation_run",
  "simulation_verdict",
  "requirement_run",
  "deck_export",
  "requirement",
  "requirement_event",
] as const

export type DataTable = (typeof DATA_TABLES)[number]

/** head-count of each table; null when the table is not there or the count fails. */
export async function dataSources(): Promise<Record<DataTable, number | null>> {
  const counts = await Promise.all(
    DATA_TABLES.map(async (t): Promise<number | null> => {
      try {
        const { count, error } = await db.from(t).select("*", { count: "exact", head: true })
        if (error) return null
        return count ?? null
      } catch {
        return null
      }
    })
  )
  return Object.fromEntries(DATA_TABLES.map((t, i) => [t, counts[i]])) as Record<DataTable, number | null>
}
