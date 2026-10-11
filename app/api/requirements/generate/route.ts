import { generate } from "@/lib/requirements/engine"
import { LIMITS } from "@/lib/requirements/config"
import type { GenerateOptions, UploadedCsv } from "@/lib/requirements/types"
import { VEHICLES, vehicleOf } from "@/lib/scope"

export const maxDuration = 300

const actorOf = (v: unknown) => {
  const n = typeof v === "string" ? v.trim().slice(0, 60) : ""
  return n ? `${n} (not signed in)` : "Anonymous PM (not signed in)"
}

// POST { vehicle, options: { public, research, whatif }, csv?: { name, rows }, actor? } -> a finished run summary.
// The PM's own OpenAI key may come in x-openai-key (never stored); otherwise the team key is used, rate-limited.
export async function POST(req: Request) {
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > LIMITS.csvMaxBytes + 10_000) return Response.json({ error: "Request too large" }, { status: 413 })
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) } catch { return Response.json({ error: "JSON body required" }, { status: 400 }) }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "JSON object required" }, { status: 400 })
  if (!VEHICLES.some((v) => v.id === body.vehicle)) return Response.json({ error: "Unknown vehicle" }, { status: 400 })
  const vehicle = vehicleOf(body.vehicle as string)
  if (body.options !== undefined && (!body.options || typeof body.options !== "object" || Array.isArray(body.options))) return Response.json({ error: "options must be an object" }, { status: 400 })
  const o = (body.options ?? {}) as Record<string, unknown>
  if (["public", "research", "whatif"].some((k) => o[k] !== undefined && typeof o[k] !== "boolean")) return Response.json({ error: "Source options must be true or false" }, { status: 400 })
  const options: GenerateOptions = { public: o.public !== false, research: o.research !== false, whatif: vehicle.id === "G60" && o.whatif !== false }

  let csv: UploadedCsv | null = null
  if (body.csv !== null && body.csv !== undefined) {
    if (typeof body.csv !== "object" || Array.isArray(body.csv)) return Response.json({ error: "csv must be an object" }, { status: 400 })
    const c = body.csv as { name?: unknown; rows?: unknown }
    if (!Array.isArray(c.rows) || c.rows.some((r) => !r || typeof r !== "object" || Array.isArray(r) || typeof r.text !== "string")) return Response.json({ error: "CSV rows must contain text" }, { status: 400 })
    if (new TextEncoder().encode(JSON.stringify(c.rows)).length > LIMITS.csvMaxBytes) return Response.json({ error: "Parsed CSV exceeds 500 KB" }, { status: 400 })
    csv = {
      name: typeof c.name === "string" ? c.name.slice(0, 120) : "upload.csv",
      rows: c.rows.slice(0, LIMITS.csvMaxRows).flatMap((row, i) => {
        const text = row.text.trim().slice(0, 1000)
        if (!text) return []
        const extra = row.extra && typeof row.extra === "object" && !Array.isArray(row.extra) ? Object.fromEntries(Object.entries(row.extra as Record<string, unknown>).slice(0, 20).map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 200)])) : {}
        return [{ id: `CSV-${i + 1}`, text, extra }]
      }),
    }
  }

  const key = req.headers.get("x-openai-key")?.trim() || null
  const model = req.headers.get("x-openai-model")?.trim() || null
  const ai = key ? { key, model: model && /^[\w.\-:]{2,60}$/.test(model) ? model : "" } : null

  // The database atomically reserves the car-line run and team-key budget.

  try {
    return Response.json(await generate({ vehicle: vehicle.id, options, csv, actor: actorOf(body.actor), ai }))
  } catch (e) {
    console.error("requirements generate failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Run failed" }, { status: e instanceof Error && e.message.startsWith("Run limit:") ? 429 : 500 })
  }
}
