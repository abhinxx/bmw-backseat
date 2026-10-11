import { admin } from "@/lib/requirements/signals"
import { generate } from "@/lib/requirements/engine"
import { LIMITS } from "@/lib/requirements/config"
import type { GenerateOptions, UploadedCsv } from "@/lib/requirements/types"
import { vehicleOf } from "@/lib/scope"

export const maxDuration = 300

const actorOf = (v: unknown) => {
  const n = typeof v === "string" ? v.trim().slice(0, 60) : ""
  return n ? `${n} (not signed in)` : "Anonymous PM (not signed in)"
}

// POST { vehicle, options: { public, research, whatif }, csv?: { name, rows }, actor? } -> a finished run summary.
// The PM's own OpenAI key may come in x-openai-key (never stored); otherwise the team key is used, rate-limited.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: "JSON body required" }, { status: 400 })
  const vehicle = vehicleOf(typeof body.vehicle === "string" ? body.vehicle : null)
  const o = (body.options ?? {}) as Record<string, unknown>
  const options: GenerateOptions = { public: o.public !== false, research: o.research !== false, whatif: o.whatif !== false }

  let csv: UploadedCsv | null = null
  if (body.csv && typeof body.csv === "object") {
    const c = body.csv as { name?: unknown; rows?: unknown }
    if (!Array.isArray(c.rows)) return Response.json({ error: "csv.rows must be a list" }, { status: 400 })
    if (JSON.stringify(c.rows).length > LIMITS.csvMaxBytes * 1.5) return Response.json({ error: "CSV too large" }, { status: 400 })
    csv = {
      name: String(c.name ?? "upload.csv").slice(0, 120),
      rows: c.rows.slice(0, LIMITS.csvMaxRows).flatMap((r, i) => {
        const row = r as { id?: unknown; text?: unknown; extra?: unknown }
        const text = typeof row.text === "string" ? row.text.trim().slice(0, 1000) : ""
        if (!text) return []
        const extra = row.extra && typeof row.extra === "object" ? Object.fromEntries(Object.entries(row.extra as Record<string, unknown>).slice(0, 20).map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 200)])) : {}
        return [{ id: `CSV-${i + 1}`, text, extra }]
      }),
    }
  }

  const key = req.headers.get("x-openai-key")?.trim() || null
  const model = req.headers.get("x-openai-model")?.trim() || null
  const ai = key ? { key, model: model && /^[\w.\-:]{2,60}$/.test(model) ? model : "" } : null

  // Guard the team key: one run at a time per car line, at most 6 runs per 10 minutes.
  if (!ai) {
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data: recent } = await admin().from("requirement_run").select("status, created_at").eq("vehicle", vehicle.id).gte("created_at", since)
    const rows = (recent ?? []) as { status: string; created_at: string }[]
    if (rows.some((r) => r.status === "running" && Date.now() - Date.parse(r.created_at) < 4 * 60_000))
      return Response.json({ error: "A run for this car line is already in progress. Wait for it to finish." }, { status: 429 })
    if (rows.length >= 6) return Response.json({ error: "Too many runs in the last 10 minutes on the team key. Add your own key in Settings or wait." }, { status: 429 })
  }

  try {
    return Response.json(await generate({ vehicle: vehicle.id, options, csv, actor: actorOf(body.actor), ai }))
  } catch (e) {
    console.error("requirements generate failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Run failed" }, { status: 500 })
  }
}
