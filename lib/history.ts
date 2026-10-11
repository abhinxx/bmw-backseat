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

// ---------- Research runs and their findings ----------
export type ResearchRow = {
  id: string
  created_at: string
  vehicle: string
  mission: string
  depth: string
  question: string
  model: string
  linkup_calls: number
  findings: { count: number }[]
}

export async function recentResearch(limit = 100): Promise<ResearchRow[]> {
  const { data, error } = await client
    .from("research_run")
    .select("id, created_at, vehicle, mission, depth, question, model, linkup_calls, findings:research_finding(count)")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ResearchRow[]
}

export type FeedFinding = {
  id: string
  created_at: string
  run_id: string
  vehicle: string
  claim: string
  feature_id: string
  relation: string | null
  source_url: string
  source_name: string | null
}

// Findings that matched one of the 16 features: these are the ones Mission Control shows.
export async function featureFindings(vehicle: string, limit = 6): Promise<FeedFinding[]> {
  const { data, error } = await client
    .from("research_finding")
    .select("id, created_at, run_id, vehicle, claim, feature_id, relation, source_url, source_name")
    .eq("vehicle", vehicle)
    .not("feature_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as FeedFinding[]
}
