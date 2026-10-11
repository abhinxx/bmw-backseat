import { DEPTHS, loadResearchRun, MISSIONS, runResearch, type DepthId, type MissionId } from "@/lib/research"
import { vehicleOf } from "@/lib/scope"

export const maxDuration = 300

// POST { vehicle, mission, depth, question } -> a new stored research run. GET ?run=<id> -> a stored run.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const question = typeof body?.question === "string" ? body.question.trim() : ""
  const mission = String(body?.mission ?? "")
  const depth = String(body?.depth ?? "")
  if (question.length < 5 || question.length > 500) return Response.json({ error: "Ask a question in 5 to 500 characters." }, { status: 400 })
  if (!(mission in MISSIONS)) return Response.json({ error: "Unknown mission." }, { status: 400 })
  if (!(depth in DEPTHS)) return Response.json({ error: "Unknown depth." }, { status: 400 })
  const vehicle = vehicleOf(typeof body?.vehicle === "string" ? body.vehicle : null)
  try {
    return Response.json(
      await runResearch({ vehicle: vehicle.id, vehicleName: vehicle.name, mission: mission as MissionId, depth: depth as DepthId, question })
    )
  } catch (e) {
    console.error("research failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Research failed" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("run")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "run id required" }, { status: 400 })
  const run = await loadResearchRun(id)
  return run ? Response.json(run) : Response.json({ error: "not found" }, { status: 404 })
}
