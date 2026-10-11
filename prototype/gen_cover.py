#!/usr/bin/env python3
"""Two-step per docs/DECK-EXPORT-SPEC.md Prompt B: the copy model authors the full
image prompt from a direction brief; the server appends the non-overridable compliance
footer; then gpt-image-2.5-flare renders it. Portrait for a full-bleed brochure cover."""
import json, base64, pathlib, sys, urllib.request, time

env = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1); env[k.strip()] = v.strip()
KEY = env['OPENAI_API_KEY']

def post(url, body, timeout=180):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

DIRECTION = """You are the art director for BMW Backseat decision memos. Write ONE image-generation
prompt (80-140 words) for a PORTRAIT (vertical) premium cover illustration of a decision
memo proposing to SIMPLIFY THE iDRIVE CONTROLS on the BMW 5 Series.
- Mood: BMW brochure level — night-shot darkness, high contrast, precise, calm, premium.
- Background must be deep charcoal/near-black (#1d1d1f) and stay darkest and quietest in
  the bottom third (a title will be overlaid there).
- Subject specific to THIS proposal: the physical experience of the center console —
  iDrive rotary controller, control surfaces, menu logic made one clean gesture simple.
  The copy model suggested 'tangled wires resolving into one clean line' before; go beyond it.
- Encode nine customer segments' reaction (6 positive, 1 neutral, 2 cautious) as small
  glowing dots/objects: 6 signal-green (#166534), 1 cool gray, 2 warning amber (#b45309),
  placed like a constellation or arc — never as a chart.
- Vertical composition, focal object in the upper two-thirds.
- Output ONLY the prompt text."""

FOOTER = """ Hard constraints (non-negotiable): absolutely NO text, letters, numbers, charts
with labels, logos, brand badges on vehicles, watermarks or readable signage anywhere;
no photorealistic human faces; premium pseudo-3D/flat editorial illustration; palette
limited to charcoal #1d1d1f background, cool grays, signal green #166534, warning amber
#b45309, BMW blue #0066B1 accents; bottom third stays dark and detail-free."""

t0 = time.time()
r1 = post('https://api.openai.com/v1/chat/completions', {
    'model': 'gpt-6-luna',
    'messages': [{'role': 'user', 'content': DIRECTION}],
    'max_completion_tokens': 400})
prompt = r1['choices'][0]['message']['content'].strip()
print('AUTHORED PROMPT:', prompt[:400], '...', flush=True)

r2 = post('https://api.openai.com/v1/images/generations', {
    'model': 'gpt-image-2.5-flare', 'prompt': prompt + FOOTER,
    'size': '1024x1536', 'quality': 'medium'}, timeout=300)
img = r2['data'][0]
raw = base64.b64decode(img['b64_json']) if 'b64_json' in img else urllib.request.urlopen(img['url'], timeout=60).read()
out = pathlib.Path(pathlib.Path(__file__).parent / 'cover_portrait.png')
out.write_bytes(raw)
print(f'OK {out} {len(raw)/1e6:.2f} MB in {time.time()-t0:.1f}s (copy {len(prompt.split())} words)')
