// One deck, end to end: payload -> copy -> cover image -> PDF -> storage -> deck_export row.
// Runs synchronously inside /api/deck (Node route, maxDuration 120).
import { createClient } from "@supabase/supabase-js"

import { copyForDeck } from "@/lib/deck/copy"
import { makeCover, IMAGE_MODEL } from "@/lib/deck/image"
import { payloadForRun } from "@/lib/deck/payload"
import { renderDeckPdf } from "@/lib/deck/pdf"
import { MODEL } from "@/lib/simulate"

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

export async function generateDeck(runId: string): Promise<"ready" | "failed"> {
  const db = admin()
  const mark = async (patch: Record<string, unknown>) => {
    const { error } = await db.from("deck_export").update({ ...patch, updated_at: new Date().toISOString() }).eq("run_id", runId)
    if (error) console.error("deck_export update failed:", error.message)
  }
  try {
    const payload = await payloadForRun(runId)
    if (!payload) throw new Error(`run ${runId} not found`)

    const { copy, source } = await copyForDeck(payload)
    const cover = await makeCover(copy.image_prompt)
    const pdf = await renderDeckPdf({ payload, copy, cover: cover?.buffer ?? null })

    const pdfPath = `decks/${runId}/deck.pdf`
    const pngPath = cover ? `decks/${runId}/cover.png` : null
    const up = await db.storage.from("decks").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true })
    if (up.error) throw new Error(`storage pdf: ${up.error.message}`)
    if (cover && pngPath) {
      const up2 = await db.storage.from("decks").upload(pngPath, cover.buffer, { contentType: "image/png", upsert: true })
      if (up2.error) console.error("cover upload failed (deck still ships):", up2.error.message)
    }

    await mark({
      status: "ready",
      pdf_path: pdfPath,
      png_path: cover ? pngPath : null,
      copy,
      copy_source: source,
      image_prompt: cover?.prompt ?? null,
      model: MODEL,
      image_model: cover ? IMAGE_MODEL : null,
      error: null,
    })
    return "ready"
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("deck generation failed:", message)
    await mark({ status: "failed", error: message.slice(0, 500) })
    return "failed"
  }
}
