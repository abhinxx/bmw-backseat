// Test an OpenAI key the PM just typed, without storing it anywhere.
// The key is only forwarded to OpenAI in the Authorization header; it is never logged or echoed back.
export const maxDuration = 30

// shortcut: per-instance burst guard; use shared storage for a workspace-wide BYOK-test budget.
let windowStart = 0
let requests = 0

export async function POST(req: Request) {
  if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); requests = 0 }
  if (++requests > 30) return Response.json({ ok: false, message: "Too many key tests. Try again in a minute." }, { status: 429 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const provider = typeof body?.provider === "string" ? body.provider : ""
  const key = typeof body?.key === "string" ? body.key.trim() : ""

  if (provider !== "openai") {
    return Response.json(
      { ok: false, message: "Only OpenAI keys can be tested in this prototype." },
      { status: 400 }
    )
  }
  if (key.length < 20 || key.length > 300) {
    return Response.json({ ok: false, message: "That does not look like an OpenAI key (20-300 characters)." }, { status: 400 })
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      return Response.json({ ok: false, message: `OpenAI said ${res.status}` })
    }
    const json = (await res.json()) as { data?: { id?: string }[] }
    const models = json.data ?? []
    const has = models.some((m) => m.id === "gpt-6-luna")
    return Response.json({
      ok: true,
      message: `Key works: ${models.length} models available${has ? ", gpt-6-luna included" : ", gpt-6-luna not available on this key"}`,
    })
  } catch {
    return Response.json({ ok: false, message: "OpenAI said unreachable" })
  }
}
