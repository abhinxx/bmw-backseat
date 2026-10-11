import { loadRun, runWhatIf } from "@/lib/simulate"
import { vehicleOf } from "@/lib/scope"

export const maxDuration = 60

// POST { question, vehicle } -> a stored run (new or cached). GET ?run=<id> -> a stored run.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown; vehicle?: unknown } | null
  const question = typeof body?.question === "string" ? body.question.trim() : ""
  if (question.length < 5 || question.length > 500) {
    return Response.json({ error: "Describe the change in 5 to 500 characters." }, { status: 400 })
  }
  const vehicle = vehicleOf(typeof body?.vehicle === "string" ? body.vehicle : null)
  if (vehicle.id !== "G60") {
    return Response.json(
      { error: `Customer segments exist for the 5 Series only. Switch the vehicle to 5 Series to simulate.` },
      { status: 400 }
    )
  }
  try {
    return Response.json(await runWhatIf(question, vehicle.id, vehicle.name))
  } catch (e) {
    console.error("what-if failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Simulation failed" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("run")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "run id required" }, { status: 400 })
  const run = await loadRun(id)
  return run ? Response.json(run) : Response.json({ error: "not found" }, { status: 404 })
}
