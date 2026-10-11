# Deck Export — design + AI system prompts (spec PR, no runtime code)

Goal: on the What-If result (a stored `simulation_run`), an **Export deck** button triggers a background job that produces a short, corporate-ready PDF decision memo with a generated infographic, stored per-run. The run row in **History** shows a "PDF ready" badge; clicking it opens/downloads the PDF. Navigation stays instant because generation is async and every artifact is keyed by the run UUID (shareable URL `/what-if?run=<uuid>`).

## Validated platform facts (Oct 2026)

- Image model: `gpt-image-2.5-flare` (default, fast) / `gpt-image-2.5-sunburst` (precision edits), via `POST /v1/images/generations`, returns `data[0].b64_json`. Sizes incl. `1536x1024`; `quality: medium` ≈ $0.01/img at 1536×1024 (flare/sunburst, token-priced like gpt-image-2). Sources: openai.com/index/introducing-chatgpt-images-2-5, platform.openai.com/docs/guides/image-generation.
- PDF: `@react-pdf/renderer` in a **Node.js runtime route handler** (`renderToStream` → `Readable.toWeb` → `Response` with `Content-Disposition: attachment`). Known Next.js pitfall: add `serverComponentsExternalPackages: ['@react-pdf/renderer']` to `next.config` or RSC bundling breaks. No Puppeteer/Chrome (won't run serverless). Sources: vercel/next.js#61313, screenshotneo Next.js PDF guide.
- Vercel limits: function bundle ≤250 MB, `/tmp` 500 MB, set `export const maxDuration = 60` (image + PDF in one job); default anon RLS read on `simulation_*` already works.
- Keys: `OPENAI_API_KEY` lives on Vercel env (pushed via `npm run env:push`), read server-side only. Images must be generated **server-side** — never from the browser.

## Pipeline (all server, async)

1. `POST /api/deck` `{ runId }` → insert `deck_export` row `{run_id, status:'queued'}`, fire a self-fetch to `/api/deck/work` (or Vercel QJS later), return `202 {status}` immediately. UI shows "Deck generating…" and moves on; anything else stays navigable.
2. Worker (Node route, `maxDuration=60`):
   a. **Deterministic assembly from the DB — AI never touches numbers.** Load run + verdicts + per-verdict stored `evidence` jsonb (exactly what the model saw), personas, sales, `simulation_run.model/prompt_version`. Compute: verdict counts + net lean, evidence counts per sentiment, sales 2025/2030, per-persona table, full citation map (ID → verbatim text/study cell, who it supports/against). This is the **grounded payload**; it is the ONLY source of figures.
   b. **Copy call** (`gpt-6-luna`, `response_format json_schema`, same provenance discipline as `lib/simulate.ts`): the model receives ONLY the grounded payload and writes short narrative copy (title line, 3-bullet executive summary, one-line takeaway). Server-side validator rejects any citation ID or digit-string in the copy that is not present in the payload → fall back to deterministic copy. Copy failure must never block the deck.
   c. **Infographic call** (`gpt-image-2.5-flare`, `1536x1024`, `quality:medium`, png): the image prompt is generated from the payload by a strict template (see Prompt B) — visual metaphor + palette + "no numbers, no text" constraint. Images with text/numbers baked in are illegible after PDF scaling and invite hallucinated figures; all data stays in the PDF's own vector text.
   d. **Render** `@react-pdf/renderer` template (design: cover w/ verdict board + infographic, segment board, evidence that moved verdicts, assumptions, appendix citation map — see prototype, approved by the team) → upload PDF + PNG to Supabase Storage bucket `decks` (service role). Update `deck_export {status:'ready', pdf_path, png_path}`; on failure `{status:'failed', error}`.
3. History page: left-join `deck_export`, badge per run: `generating…` / `PDF ready` / `failed (retry)`; click → `GET /api/deck/file?id=…` which streams storage → `Content-Disposition: attachment` (auto-download, no RLS exposure of public bucket).

Idempotency: unique `(run_id)`; re-export = delete+rebuild. Deck content is frozen to the stored run (same replay guarantee as What-If).

## Prompt A — deck copy writer (system message, gpt-6-luna, json_schema)

```
You are the copy writer for BMW Backseat, an evidence-led product-intelligence console.
You receive a JSON payload describing one stored What-If simulation run: the proposal
question, the vehicle, nine persona verdicts with confidence, evidence totals, cited
evidence items (verbatim comments / study cells, each with an ID), and market volumes.

Write the narrative copy for a 5-page corporate decision memo. Rules, in priority order:
1. USE ONLY FACTS IN THE PAYLOAD. Every number you output must appear verbatim in the
   payload. Every evidence ID you output (G60-xxxx or STUDY-n) must exist in
   payload.cited[]. A validator rejects the whole response otherwise — then deterministic
   fallback copy ships instead, so strictness pays.
2. Audience: BMW product managers forwarding this internally. Corporate, direct, short.
   No marketing adjectives ("game-changing", "revolutionary", "seamless"). No em-dash
   padding, no exclamation marks.
3. Honesty rules inherited from the product: verdicts are simulated persona interpretations,
   never "customer votes"; anything forward-looking belongs to assumptions, not evidence;
   when a verdict is 'not_enough_evidence', say so plainly.
4. Tone per segment voice exists ONLY in verdict.reaction — do not rewrite those quotes.
5. Output exactly this JSON: {
  "title_line": "≤60 chars, the proposal as a decision, not a question",
  "exec_bullets": [ "≤140 chars, 3 bullets: net verdict + strongest evidence; the
                    main opposing signal; the honest caveat (tier/confidence/coverage)" ],
  "takeaway": "≤180 chars, one sentence a PM would repeat in a meeting",
  "image_prompt": "60-120 words, the COMPLETE prompt for the cover illustration —
                    you are the art director: subject and metaphor specific to THIS
                    proposal (see art-director rules below); composition encodes the
                    verdict split through objects, never through data"
}
6. If payload totals show llm_called=false for a persona, never describe its verdict as
   evidence-based.
```

The copy call's output includes the full image prompt (author role above); the server
concatenates the compliance footer and is the only thing that talks to the image API.

## Prompt B — image prompt writer (direction brief; the model writes the FULL image prompt)

The copy model, having read the grounded payload, is asked to AUTHOR the complete
image prompt itself — subject, visual metaphor and composition all follow the actual
proposal (seat heating ⇒ cabin comfort scenes; iDrive ⇒ control surfaces; pricing ⇒
value perception). A fixed art template does NOT generalize; only the constraints below
are fixed, and the server appends them so they cannot be negotiated away:

System message (direction brief):
```
You are the art director for BMW Backseat decision memos. Given the payload's proposal
question and verdict composition, write ONE image-generation prompt (60-120 words) for
a high-definition editorial illustration that visually argues the memo's story.
- Subject and metaphor must be specific to THIS proposal's change (what physically or
  experientially changes for the customer), not generic automotive stock.
- Encode the verdict composition through objects/composition (count, color, placement),
  never through data graphics.
- Scene style: premium editorial isometric/flat illustration, calm, corporate.
- Output only the prompt text.
```

Server-appended compliance footer (always concatenated after the model's prompt, before
the call — the model cannot override it):
```
Hard constraints (non-negotiable): absolutely NO text, letters, numbers, charts with
labels, logos, watermarks, brand names or readable signage anywhere; no photorealistic
human faces; flat/pseudo-3D editorial illustration only; palette limited to charcoal
#1d1d1f, cool gray #f4f5f7, signal green #166534, warning amber #b45309, blue #0653b6;
landscape composition safe to crop to 16:9 with the focal object in the lower half
(the PDF title sits below the image). The PDF prints all text and data itself.
```

Call: `gpt-image-2.5-flare`, `1536x1024`, `quality:medium`. Live-verified 2026-10-11:
11.8 s, ~$0.01, output passed strict vision QA (zero text; composition encoded 6/1/2
segment split correctly from payload counts).

Retry policy: one regeneration at `quality:low` if vision-QA flags text/numbers (cheap
automated check with the same vision model); if it still fails, render the deck without
the hero slot — the deck must never fail because of art.

## Prototype (approved look)

Final prototype (6 pages, reportlab, against the REAL run "Simplify the iDrive controls",
`run 25edcfdf…`): cover = generated hero image (live `gpt-image-2.5-flare` output,
full-width, focal objects kept clear of the title below) + proposal title + KPI rows
(net verdict, evidence cited, market volumes) + provenance disclaimer; segment verdict
bars on a shared 5-point track (green positive / gray neutral / tick = insufficient);
segment board = 9 rows with avatar PNGs, two-word blurbs, Ampel tier column, quotes in
table order; "What the evidence says" (verbatim customer text + study cells, every claim
carries its ID); assumptions; appendix = full citation map (ID -> verbatim text/cell,
supports/against per segment). Vision-QA'd page by page: no clipping, no overflow, no
cross-column collision. Note: the model spontaneously placed a BMW roundel on the car —
fine here (BMW doc), the compliance footer says no-logos and vision-QA flags any
third-party marks; if we want the art logo-free too, tighten the footer to "no badges
on vehicles". Production ports this exact layout to `@react-pdf/renderer`; the PDF, PNG
and the exact prompts used are stored per run so any deck is reproducible from
`run_id` alone.

## Needs from the team

- `OPENAI_API_KEY` locally (`npm run env:push` or paste into `.env.local`) to live-test images; prod already has it.
- Supabase Storage: create private bucket `decks` + `deck_export` table migration (I'll PR the migration).
- Vercel: `maxDuration` for the work route; confirm plan allows 60s.
