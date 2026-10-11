// Server-side reads for the Requirements screens (anon key, read-only).
import { createClient } from "@supabase/supabase-js"

import type { ReqEvent, ReqRun, Requirement } from "@/lib/requirements/types"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export async function listRequirements(vehicle: string): Promise<Requirement[]> {
  const { data, error } = await db.from("requirement").select("*").eq("vehicle", vehicle).order("rank")
  if (error) throw new Error(`requirement: ${error.message}`)
  return (data ?? []) as Requirement[]
}

export async function getRequirement(code: string): Promise<{ req: Requirement; events: ReqEvent[] } | null> {
  const { data, error } = await db.from("requirement").select("*").eq("code", code).maybeSingle()
  if (error) throw new Error(`requirement: ${error.message}`)
  if (!data) return null
  const { data: ev, error: evErr } = await db.from("requirement_event").select("*").eq("requirement_id", data.id).order("at", { ascending: false }).order("id", { ascending: false })
  if (evErr) throw new Error(`requirement_event: ${evErr.message}`)
  return { req: data as Requirement, events: (ev ?? []) as ReqEvent[] }
}

export async function recentRuns(vehicle: string, limit = 5): Promise<ReqRun[]> {
  const { data, error } = await db
    .from("requirement_run")
    .select("id, created_at, vehicle, options, weights, score_version, prompt_version, model, csv_name, csv_rows, actor, status, duration_ms, summary")
    .eq("vehicle", vehicle)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`requirement_run: ${error.message}`)
  return ((data ?? []) as (Omit<ReqRun, "csv_count"> & { csv_rows: unknown[] | null })[]).map(({ csv_rows, ...r }) => ({ ...r, csv_count: csv_rows?.length ?? 0 }))
}

/** Latest decisions across all requirements of a car line (for the board's activity strip). */
export async function recentDecisions(ids: string[], limit = 6): Promise<ReqEvent[]> {
  if (!ids.length) return []
  const { data, error } = await db.from("requirement_event").select("*").in("requirement_id", ids).eq("actor_type", "pm").order("at", { ascending: false }).limit(limit)
  if (error) throw new Error(`requirement_event: ${error.message}`)
  return (data ?? []) as ReqEvent[]
}

/** Share of this car line's feedback that comes from the US (the coverage blind spot, shown once on the board). */
export async function usShare(vehicle: string): Promise<number | null> {
  const { data, error } = await db.rpc("feedback_coverage", { p_model: vehicle })
  if (error) return null
  const rows = (data ?? []) as { country: string | null; comments: number }[]
  const total = rows.reduce((s, r) => s + Number(r.comments), 0)
  return total ? rows.filter((r) => r.country === "US").reduce((s, r) => s + Number(r.comments), 0) / total : null
}
