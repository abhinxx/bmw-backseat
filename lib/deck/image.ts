// Cover image: one gpt-image call with the copy model's art direction plus the server's
// non-negotiable compliance footer (spec Prompt B). Any failure -> no image; the deck renders without it.
export const IMAGE_MODEL = "gpt-image-2.5-flare"

// Spec compliance footer, verbatim, plus the logo-free tightening agreed for production.
export const COMPLIANCE_FOOTER = `Hard constraints (non-negotiable): absolutely NO text, letters, numbers, charts with
labels, logos, watermarks, brand names or readable signage anywhere; no photorealistic
human faces; flat/pseudo-3D editorial illustration only; palette limited to charcoal
#1d1d1f, cool gray #f4f5f7, signal green #166534, warning amber #b45309, blue #0653b6;
landscape composition safe to crop to 16:9 with the focal object in the lower half
(the PDF title sits below the image). The PDF prints all text and data itself.
No badges, emblems or grille logos on any vehicle.`

export type Cover = { buffer: Buffer; prompt: string }

// The PDF cover slot is the full A4-landscape text width at 216pt (762x216). Pre-crop the 3:2
// image to that aspect (cover-style centre band) so the slot never distorts it.
const COVER_W = 1524
const COVER_H = 432

async function cropCover(png: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp")
    return await sharp(png).resize(COVER_W, COVER_H, { fit: "cover", position: "centre" }).png().toBuffer()
  } catch (e) {
    console.error("cover crop failed, using the uncropped image:", e)
    return png
  }
}

export async function makeCover(artPrompt: string): Promise<Cover | null> {
  const prompt = `${artPrompt}\n\n${COMPLIANCE_FOOTER}`
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1536x1024", quality: "medium" }),
    })
    if (!res.ok) {
      console.error("image call failed:", res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = (await res.json()) as { data?: { b64_json?: string }[] }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return null
    return { buffer: await cropCover(Buffer.from(b64, "base64")), prompt }
  } catch (e) {
    console.error("image call errored:", e)
    return null
  }
}
