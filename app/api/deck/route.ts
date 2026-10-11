// Deck export API (docs/DECK-EXPORT-SPEC.md, simplified to synchronous generation).
// POST {runId} generates the deck for a stored run and answers when it is done; GET ?run=<id> reports status.
import { createClient } from "@supabase/supabase-js"

import { generateDeck } from "@/lib/deck/generate"
import { loadRun } from "@/lib/simulate"

export const runtime = "nodejs"
export const maxDuration = 120

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { runId?: unknown } | null
  const runId = body?.runId
  if (!isUuid(runId)) return Response.json({ error: "runId (uuid) required" }, { status: 400 })

  const db = admin()
  const existing = await db.from("deck_export").select("status, updated_at").eq("run_id", runId).maybeSingle()
  if (existing.error) return Response.json({ error: existing.error.message }, { status: 500 })

  if (existing.data?.status === "ready") return Response.json({ status: "ready" })
  // Another tab pressed export moments ago and that request is still in flight: don't double-generate.
  if (existing.data?.status === "generating" && Date.now() - new Date(existing.data.updated_at).getTime() < 180_000)
    return Response.json({ status: "generating" }, { status: 202 })

  if (!(await loadRun(runId))) return Response.json({ error: "run not found" }, { status: 404 })

  const up = await db
    .from("deck_export")
    .upsert(
      { run_id: runId, status: "generating", updated_at: new Date().toISOString() },
      { onConflict: "run_id" }
    )
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 })

  const status = await generateDeck(runId)
  if (status === "ready") return Response.json({ status })
  const row = await db.from("deck_export").select("error").eq("run_id", runId).maybeSingle()
  return Response.json({ status, error: row.data?.error ?? "deck generation failed" })
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("run")
  if (!isUuid(id)) return Response.json({ error: "run id required" }, { status: 400 })
  const { data, error } = await admin().from("deck_export").select("status").eq("run_id", id).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ status: data?.status ?? "none" })
}
