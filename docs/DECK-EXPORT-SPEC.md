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
  "infographic_concept": "see constraints given in a separate image-model system prompt;
                          describe the SCENE only in ≤45 words, no numbers, no text, no
                          brand names, no people's faces"
}
6. If payload totals show llm_called=false for a persona, never describe its verdict as
   evidence-based.
```

The `infographic_concept` string is then interpolated into Prompt B server-side; the model never talks to the image API directly.

## Prompt B — infographic (system-ish block prepended to every image request, gpt-image-2.5-flare)

```
Create one editorial data-journalism style infographic illustration for a BMW product
memo about: "{question}".
Concept: {infographic_concept}.
Art direction: flat vector illustration, BMW-adjacent palette (charcoal #1d1d1f, cool
gray #f4f5f7, one signal green #166534, one warning amber #b45309), generous white
space, subtle isometric G60 sedan silhouette as anchor object, visual grouping that
mirrors {pos_count} positive / {neg_count} negative / {unk_count} unknown segment
reactions through composition (count and color of accent objects), NOT through data.
Hard constraints: absolutely NO text, letters, numbers, logos, watermarks, brand names,
or readable signage anywhere in the image; no photorealistic human faces; landscape
composition safe to crop to 16:9. The PDF will print all text itself.
```

Retry policy: one retry at `quality:low`; if still failing, render the deck without the image slot (deck must never fail because of art).

## Prototype (approved look)

Built with reportlab against the REAL run "Simplify the iDrive controls" (`run 25edcfdf…`): 5 pages — cover (title, KPI rows, verdict bars, infographic slot), segment board (9 rows, Ampel tier column, quotes in table order), evidence that moved verdicts (verbatim quotes with per-ID attribution + study-cell table), assumptions, appendix citation map (every ID, for/against, segments, truncated verbatim). Vision-QA'd: no clipping/overflow, traceable IDs on every claim. Final implementation ports the layout to `@react-pdf/renderer`; the PDF bytes, PNG, and prompts are stored so every deck is reproducible from `run_id` alone.

## Needs from the team

- `OPENAI_API_KEY` locally (`npm run env:push` or paste into `.env.local`) to live-test images; prod already has it.
- Supabase Storage: create private bucket `decks` + `deck_export` table migration (I'll PR the migration).
- Vercel: `maxDuration` for the work route; confirm plan allows 60s.
