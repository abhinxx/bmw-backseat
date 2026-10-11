# Deck export — local prototype (NOT deployed code)

Proof that the deck renders from a stored run, plus the exact prompts. Production uses
`@react-pdf/renderer` in a Node route (see ../docs/DECK-EXPORT-SPEC.md) — **no Python on Vercel**,
this folder is a layout blueprint + reproducible reference artifacts.

```
python3 deck_proto.py <path-to-.env.local>   # -> backseat-deck-proto.pdf (~1s with cached payloads)
python3 gen_cover.py   <path-to-.env.local>   # direction brief -> gpt-6-luna authors prompt -> gpt-image-2.5-flare renders cover_portrait.png
```

- Data: reads simulation_run / simulation_verdict / feedback_comment / sales_volume via the
  Supabase REST API with the public anon key; first run caches payloads next to the script
  (delete the *_full.json / comments_full.json files to re-pull). Comment ids are fetched
  one-by-one because the `in.()` PostgREST filter currently 400s (known bug, separate fix).
- Avatars: personas/avatars/*.svg rendered to PNG (`qlmanage -t -s 200 -o av personas/avatars/*.svg`
  on macOS; any SVG rasteriser works elsewhere). Only AM-1.png is committed as a sample.
- cover_portrait.png + the sample PDF are committed so the deck can be reviewed without keys.
- Every number/quote in the PDF is set from DB rows; the image contributes zero data
  (its 6-green/1-gray/2-amber dot constellation matches the verdict split, but the
  printed figures never come from it).
