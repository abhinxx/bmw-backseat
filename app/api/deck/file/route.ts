// Streams the stored deck PDF from the private 'decks' bucket (service role) as a download.
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("run")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "run id required" }, { status: 400 })

  const db = admin()
  const [deck, run] = await Promise.all([
    db.from("deck_export").select("status, pdf_path").eq("run_id", id).maybeSingle(),
    db.from("simulation_run").select("vehicle").eq("id", id).maybeSingle(),
  ])
  if (deck.error) return Response.json({ error: deck.error.message }, { status: 500 })
  if (!deck.data || deck.data.status !== "ready" || !deck.data.pdf_path)
    return Response.json({ error: "deck not ready" }, { status: 404 })

  const file = await db.storage.from("decks").download(deck.data.pdf_path)
  if (file.error) return Response.json({ error: file.error.message }, { status: 500 })

  const vehicle = (run.data?.vehicle as string | undefined) ?? "run"
  const filename = `backseat-${vehicle}-${id.slice(0, 8)}.pdf`
  return new Response(file.data!.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
