// Read side of the audit trail: the saved what-if runs, listed newest first.
import { createClient } from "@supabase/supabase-js"

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export type RunRow = {
  id: string
  created_at: string
  vehicle: string
  question: string
  feature_id: string | null
  model: string
  prompt_version: string
  verdicts: { verdict: string }[]
}

export async function recentRuns(limit = 100): Promise<RunRow[]> {
  const { data, error } = await client
    .from("simulation_run")
    .select(
      "id, created_at, vehicle, question, feature_id, model, prompt_version, verdicts:simulation_verdict(verdict)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RunRow[]
}

export function tally(verdicts: { verdict: string }[]) {
  let more = 0
  let none = 0
  let less = 0
  let noEvidence = 0
  for (const v of verdicts) {
    if (v.verdict === "more_likely" || v.verdict === "slightly_more_likely") more++
    else if (v.verdict === "slightly_less_likely" || v.verdict === "less_likely") less++
    else if (v.verdict === "no_effect") none++
    else if (v.verdict === "not_enough_evidence") noEvidence++
  }
  return { more, none, less, noEvidence }
}
