// Counts for the Workflow funnel: how much evidence goes in and how many requirements come out,
// per car line. Same anon client style as lib/data.ts. The requirement tables may not exist yet,
// so every query is isolated: a failure yields null for that number, never a thrown error.
import { createClient } from "@supabase/supabase-js"

import { FEATURES } from "@/lib/features"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export type FunnelCounts = {
  comments: number | null
  outside: number | null
  research: number | null
  features: number
  requirements: number | null
  approved: number | null
  decisions: number | null
}

/** head count of one table with one filter; null when the table or column is not there (yet). */
async function headCount(table: string, column: string, value: string): Promise<number | null> {
  try {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value)
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

export async function funnel(vehicle: string): Promise<FunnelCounts> {
  const [comments, outside, research, requirements, approved, decisions] = await Promise.all([
    headCount("feedback_comment", "model", vehicle),
    headCount("external_finding", "vehicle", vehicle),
    headCount("research_finding", "vehicle", vehicle),
    headCount("requirement", "vehicle", vehicle),
    (async () => {
      try {
        const { count, error } = await db
          .from("requirement")
          .select("*", { count: "exact", head: true })
          .eq("vehicle", vehicle)
          .eq("status", "approved")
        if (error) return null
        return count ?? 0
      } catch {
        return null
      }
    })(),
    // requirement_event has no vehicle column: count every PM decision in the tool.
    headCount("requirement_event", "actor_type", "pm"),
  ])

  return { comments, outside, research, features: FEATURES.length, requirements, approved, decisions }
}
