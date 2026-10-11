import { challenge, pmAction, type PmAction } from "@/lib/requirements/engine"
import { LIMITS } from "@/lib/requirements/config"
import { REQ_STATUSES, type Priority, type ReqStatus } from "@/lib/requirements/types"

export const maxDuration = 120

const actorOf = (v: unknown) => {
  const n = typeof v === "string" ? v.trim().slice(0, 60) : ""
  return n ? `${n} (not signed in)` : "Anonymous PM (not signed in)"
}

// POST { type: status | edit | priority | challenge, ..., reason, actor } -> logged human decision (or AI challenge).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Unknown requirement" }, { status: 400 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "JSON body required" }, { status: 400 })
  const actor = actorOf(body.actor)
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : ""

  if (reason.trim().length < LIMITS.reasonMinChars) return Response.json({ error: "Give a reason (at least 5 characters). Every action is logged." }, { status: 400 })
  const version = body.version === undefined ? undefined : Number(body.version)
  if (version !== undefined && (!Number.isInteger(version) || version < 1)) return Response.json({ error: "Invalid requirement version" }, { status: 400 })

  try {
    if (body.type === "challenge") {
      const key = req.headers.get("x-openai-key")?.trim() || null
      const model = req.headers.get("x-openai-model")?.trim() || ""
      return Response.json(await challenge(id, actor, key ? { key, model: /^[\w.\-:]{2,60}$/.test(model) ? model : "" } : null, reason))
    }
    let action: PmAction
    if (body.type === "status") {
      if (!REQ_STATUSES.includes(body.status as ReqStatus)) return Response.json({ error: "Unknown status" }, { status: 400 })
      action = { type: "status", status: body.status as ReqStatus, reason }
    } else if (body.type === "edit") {
      const f = (body.fields ?? {}) as Record<string, unknown>
      const fields: Record<string, string | null> = {}
      for (const k of ["title", "description", "target"]) if (k in f) fields[k] = f[k] === null ? null : String(f[k]).slice(0, k === "title" ? 140 : 1200)
      action = { type: "edit", fields, reason }
    } else if (body.type === "priority") {
      const p = body.priority
      if (p !== null && !["P1", "P2", "P3"].includes(String(p))) return Response.json({ error: "Unknown priority" }, { status: 400 })
      action = { type: "priority", priority: p as Priority | null, reason }
    } else return Response.json({ error: "Unknown action" }, { status: 400 })
    return Response.json(await pmAction(id, action, actor, version))
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: e instanceof Error && e.message.startsWith("Run limit:") ? 429 : 400 })
  }
}
