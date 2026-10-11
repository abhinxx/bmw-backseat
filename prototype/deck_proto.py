#!/usr/bin/env python3
"""Prototype: BMW Backseat What-If run -> corporate deck PDF, from REAL Supabase data.
Mirrors the planned server flow (docs/DECK-EXPORT-SPEC.md): stored run + cited evidence
-> deterministic payload -> PDF. AI contributes only the cover hero (already generated);
every figure/text here is read from the DB, never invented.

Usage: python3 deck_proto.py <env.local path>   (needs NEXT_PUBLIC_SUPABASE_*)
Writes backseat-deck-proto.pdf next to this file.
"""
import json, sys, time, urllib.request
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
                                Table, TableStyle, PageBreak, Image as RLImage)

import pathlib
HERE = pathlib.Path(__file__).parent
ENVF = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / '.env.local'
RUN_ID = '25edcfdf-dd1b-42bb-9b6c-b5406f630cfb'  # 'Simplify the iDrive controls'
COVER = HERE / 'cover.png'                        # gpt-image-2.5-flare, 1536x1024, stored per run in prod
AV = HERE / 'avatars'                             # personas/avatars/*.svg rendered to PNG (qlmanage)

env = {}
for line in ENVF.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1); env[k.strip()] = v.strip()
U, K = env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

def get(table, q, tries=3):
    req = urllib.request.Request(f"{U}/rest/v1/{table}?{q}",
                                 headers={'apikey': K, 'Authorization': f"Bearer {K}"})
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(req, timeout=15))
        except Exception:
            if i == tries - 1: raise
            time.sleep(1)

def get_cached(table, q, cache_name):
    cache = HERE / cache_name
    if cache.exists():
        return json.loads(cache.read_text())
    rows = get(table, q)
    cache.write_text(json.dumps(rows))
    return rows

# ---------- deterministic payload (exactly what the server job will assemble) ----------
run = get_cached('simulation_run', f"id=eq.{RUN_ID}&select=*",'run_full.json')[0]
verdicts = get_cached('simulation_verdict', f"run_id=eq.{RUN_ID}&select=*",'verdicts_full.json')
persons = {}
for f in sorted(x for x in pathlib.Path('/Users/danielabirlemateos/Downloads/bmw-backseat/personas').glob('*.json') if not x.name.startswith('_')):
    d = json.loads(f.read_text()); persons[d['persona_id']] = d
sales = get_cached('sales_volume', 'select=*&limit=5000', 'sales_full.json')

cited_ids = set()
for v in verdicts:
    cited_ids |= set(v['supporting_ids'] or []); cited_ids |= set(v['opposing_ids'] or [])
comment_ids = sorted(i for i in cited_ids if i.startswith('G60'))
_cached_comments = (HERE/'comments_full.json')
if _cached_comments.exists():
    comments = {r['comment_id']: r for r in json.loads(_cached_comments.read_text())}
else:
    comments = {}
    for cid in comment_ids:  # in.() filter currently 400s (known bug) -> fetch one by one
        comments[cid] = get('feedback_comment', f"comment_id=eq.{cid}&select=*")[0]
    _cached_comments.write_text(json.dumps(list(comments.values())))
comment_ids = [c for c in comment_ids if c in comments]
study_pool = {}
for v in verdicts:
    for s in v['evidence'].get('study', []):
        study_pool.setdefault(s['id'], s)
studies = {i: study_pool[i] for i in cited_ids if i in study_pool}

CITED = {}
for cid in comment_ids:
    c = comments[cid]
    CITED[cid] = dict(kind='comment', payload=c, support=set(), oppose=set())
for sid, s in studies.items():
    CITED[sid] = dict(kind='study', payload=s, support=set(), oppose=set())
for v in verdicts:
    pid = v['persona_id']
    for i in v['supporting_ids'] or []:
        if i in CITED: CITED[i]['support'].add(pid)
    for i in v['opposing_ids'] or []:
        if i in CITED: CITED[i]['oppose'].add(pid)

VERDICT = {'much_more_likely': ('Much more likely', 2), 'slightly_more_likely': ('Slightly more likely', 1),
           'no_effect': ('No effect', 0), 'slightly_less_likely': ('Slightly less likely', -1),
           'much_less_likely': ('Much less likely', -2), 'not_enough_evidence': ('Insufficient evidence', None)}
GREEN, AMBER, RED, INK, MUTED, BG, HAIR, ACCENT = (HexColor(c) for c in
    ('#166534', '#b45309', '#b91c1c', '#1d1d1f', '#6e6e73', '#f4f5f7', '#d9dade', '#0653b6'))

def light(pid):
    """Ampel from the verified evidence matrix: green = own rows cited, amber = thin cohort, red = study/external only."""
    tier = persons[pid]['evidence_tier']
    if tier.startswith('A -'): return ('green', tier, GREEN)
    if tier.startswith('A-') or tier.startswith('B'): return ('yellow', tier, AMBER)
    return ('red', tier, RED)

name = lambda pid: persons[pid]['name']
label = lambda pid: persons[pid]['label']
BLURBS = {'AM-1': 'Tech frustrated', 'AM-2': 'Status driven', 'AM-3': 'Comfort first',
          'EU-1': 'Anxious pioneer', 'EU-2': 'Quiet majority', 'EU-3': 'Legacy driver',
          'AS-1': 'Status buyer', 'AS-2': 'Cost calculator', 'AS-3': 'Waiting skeptic'}

# ---------- document ----------
INK_H = INK
h2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=INK)
cell = ParagraphStyle('cell', fontName='Helvetica', fontSize=8, leading=10.5, textColor=INK)
tiny = ParagraphStyle('tiny', fontName='Helvetica', fontSize=7, leading=9, textColor=MUTED)
qsrc = ParagraphStyle('qsrc', fontName='Helvetica', fontSize=7.5, leading=10, textColor=MUTED)
quote = ParagraphStyle('quote', fontName='Helvetica-Oblique', fontSize=9.5, leading=13, textColor=INK)

from reportlab.lib.colors import Color

def deco_cover(c, doc):
    """Full-bleed brochure cover: portrait hero + bottom gradient, white type over it."""
    c.saveState()
    iw, ih = A4[0], A4[1]
    c.setFillColor(Color(0.09, 0.09, 0.10)); c.rect(0, 0, iw, ih, stroke=0, fill=1)
    # width-fill, bottom anchored: top bleed hidden under the header band
    ch = iw * 1536 / 1024
    c.drawImage(str(HERE/'cover_portrait.png'), 0, 0, width=iw, height=ch,
                preserveAspectRatio=False, mask=None)
    # stepped alpha rects = bottom gradient to near-black so type sits on quiet dark
    steps = 36; H = 105*mm
    for i in range(steps):
        a = 1.0 * (i + 1) / steps
        c.setFillColor(Color(0.09, 0.09, 0.10, alpha=a))
        c.rect(0, 12*mm + i * H / steps, iw, H / steps + 1, stroke=0, fill=1)
    c.setFillColor(INK_H); c.rect(0, A4[1]-14*mm, A4[0], 14*mm, stroke=0, fill=1)
    c.setFillColor(HexColor('#fff')); c.setFont('Helvetica-Bold', 8.5)
    c.drawString(13*mm, A4[1]-9*mm, 'BMW BACKSEAT · WHAT-IF DECISION MEMO')
    c.setFont('Helvetica', 7.5); c.setFillColor(HexColor('#9a9aa0'))
    c.drawRightString(A4[0]-13*mm, A4[1]-9*mm, f"{run['vehicle']} · 5 Series · evidence-led — every ID traceable")
    # title block in the bottom third
    W_ = A4[0] - 26*mm
    tc = c; tc.setFillColor(HexColor('#b9b9be')); tc.setFont('Helvetica-Bold', 8)
    tc.drawString(13*mm, 118*mm, f"PROPOSAL · 5 SERIES ({run['vehicle']})")
    tc.setFillColor(HexColor('#ffffff')); tc.setFont('Helvetica-Bold', 26)
    tc.drawString(13*mm, 108*mm, run['question'])
    tc.setFillColor(HexColor('#c9c9ce')); tc.setFont('Helvetica', 10.5)
    import textwrap
    sub = f"How the nine evidence-backed customer segments would react — simulated verdicts over {len(CITED)} cited pieces of BMW's own evidence."
    for i, ln in enumerate(textwrap.wrap(sub, 68)[:2]):
        tc.drawString(13*mm, (101 - i*5.2)*mm, ln)
    # KPI strip: label | value | detail, hairlines
    y = 78*mm
    c.setStrokeColor(HexColor('#3a3a40')); c.setLineWidth(.5)
    for label_, val, det in KPI_ROWS:
        c.line(13*mm, y + 11*mm, A4[0]-13*mm, y + 11*mm)
        c.setFillColor(HexColor('#8e8e94')); c.setFont('Helvetica', 8);  c.drawString(13*mm, y + 3*mm, label_)
        c.setFillColor(HexColor('#ffffff')); c.setFont('Helvetica-Bold', 13); c.drawString(50*mm, y + 3*mm, val)
        c.setFillColor(HexColor('#8e8e94')); c.setFont('Helvetica', 7.5)
        for j, ln in enumerate(textwrap.wrap(det, 52)[:2]):
            c.drawString(96*mm, y + (5 if j == 0 else -1)*mm, ln)
        y -= 16*mm
    c.setFillColor(HexColor('#6f6f75')); c.setFont('Helvetica', 6.8)
    c.drawString(13*mm, 20*mm, 'Cover visual: generated per proposal (direction brief → gpt-6-luna authored the prompt → gpt-image-2.5-flare). All figures set by the document, never by the image.')
    c.drawString(13*mm, 15*mm, f"Run {RUN_ID[:8]} · generated {run['created_at'][:10]} · simulated persona verdicts, not customer votes")
    c.restoreState()

def deco(c, doc):
    c.saveState()
    c.setFillColor(INK_H); c.rect(0, A4[1]-14*mm, A4[0], 14*mm, stroke=0, fill=1)
    c.setFillColor(HexColor('#fff')); c.setFont('Helvetica-Bold', 8.5)
    c.drawString(13*mm, A4[1]-9*mm, 'BMW BACKSEAT · WHAT-IF DECISION MEMO')
    c.setFont('Helvetica', 7.5); c.setFillColor(HexColor('#9a9aa0'))
    c.drawRightString(A4[0]-13*mm, A4[1]-9*mm, f"{run['vehicle']} · 5 Series · evidence-led — every ID traceable")
    c.setStrokeColor(HexColor('#e3e3e6')); c.line(13*mm, 12*mm, A4[0]-13*mm, 12*mm)
    c.setFillColor(MUTED); c.setFont('Helvetica', 7)
    c.drawString(13*mm, 8*mm, f"Run {RUN_ID[:8]} · generated {run['created_at'][:10]} · simulated persona verdicts, not customer votes")
    c.restoreState()

doc = BaseDocTemplate(str(HERE/'backseat-deck-proto.pdf'), pagesize=A4,
                      leftMargin=13*mm, rightMargin=13*mm, topMargin=18*mm, bottomMargin=15*mm)
doc.addPageTemplates([
    PageTemplate(id='cover', frames=[Frame(0, 0, 1*mm, 1*mm, id='none')], onPage=deco_cover),
    PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')], onPage=deco)])
story = []
W = 164*mm

# ---- KPI rows (drawn by the cover template) ----
n_cited = len(CITED); n_comment = len(comment_ids); n_study = len(studies)
counts = {}
for v in verdicts: counts[v['verdict']] = counts.get(v['verdict'], 0) + 1
pos = sum(counts.get(k, 0) for k in ('much_more_likely', 'slightly_more_likely'))
neg = sum(counts.get(k, 0) for k in ('much_less_likely', 'slightly_less_likely'))
none_ = counts.get('no_effect', 0); insuf = counts.get('not_enough_evidence', 0)
net = 'Lean positive' if pos > neg else ('Lean negative' if neg > pos else 'Mixed')
g60 = lambda y: sum(r['volume'] for r in sales if r['sheet'] == 'G60_G68' and r['year'] == y)
scope = verdicts[0]['evidence'].get('scope', '')
KPI_ROWS = [['Net verdict', net, f"{pos} segments more likely · {neg} less · {none_} no effect · {insuf} insufficient"],
       ['Evidence cited', str(n_cited), f"{n_comment} feedback comments · {n_study} study cells · scope: {scope}"],
       ['G60 market 2025', f"{g60(2025):,} units", f"2030 forecast {g60(2030):,} units (EU/US/CN/RoW)"]]
# cover page itself is pure canvas (deco_cover); switch to normal template from page 2
from reportlab.platypus import NextPageTemplate
story.append(NextPageTemplate('p'))
story.append(PageBreak())

# ---- P2 verdict board ----
story.append(Paragraph('How each segment would react', h2)); story.append(Spacer(1, 1*mm))
story.append(Paragraph('Bars on a shared 5-point scale (left = less likely, right = more likely). A tick means the model found too little evidence to take a position.', tiny))
story.append(Spacer(1, 4*mm))
BX0, BW = 62*mm, 68*mm
for v in sorted(verdicts, key=lambda x: -(VERDICT[x['verdict']][1] if VERDICT[x['verdict']][1] is not None else -9)):
    lab, sc = VERDICT[v['verdict']]; _k, tier, col = light(v['persona_id'])
    pid = v['persona_id']
    left = BX0 + BW*0.5 if sc is None else BX0 + BW*(sc+2)/4
    bar = Table([['']], colWidths=[BW], rowHeights=[5])
    bar.setStyle(TableStyle([('LINEABOVE', (0,0), (-1,0), .5, HexColor('#e3e3e6')), ('LINEBEFORE', (0,0), (0,0), .8, HexColor('#c8c8cc'))]))
    if sc is None:
        tick = Table([['']], colWidths=[2.2], rowHeights=[7]); tick.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),MUTED)]))
        cellbar = Table([[tick]], colWidths=[BW], rowHeights=[7], style=TableStyle([('LEFTPADDING',(0,0),(-1,-1),BW*0.5-1),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    else:
        fillw = abs(BW/8*sc)
        fill = Table([['']], colWidths=[max(fillw,3)], rowHeights=[7], style=TableStyle([('BACKGROUND',(0,0),(-1,-1),col)]))
        pad = BW*0.5 if sc > 0 else BW*0.5 - fillw
        cellbar = Table([[fill]], colWidths=[BW], rowHeights=[7], style=TableStyle([('LEFTPADDING',(0,0),(-1,-1),pad),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    avfile = AV/f"{pid}.svg.png"
    who = [Paragraph(f"<b>{name(pid)}</b>", cell), Paragraph(f"{BLURBS.get(pid,'')} · {label(pid).split('(')[0].strip()}", tiny)]
    row = Table([[RLImage(str(avfile), width=9*mm, height=9*mm) if avfile.exists() else '',
                  who, cellbar, Paragraph(f"{lab} <font color='#{col.hexval()[2:]}'>●</font>", cell)]],
                colWidths=[12*mm, 48*mm, 72*mm, 32*mm], rowHeights=[12*mm])
    row.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('LEFTPADDING', (0,0), (-1,-1), 0),
                             ('ALIGN', (0,0), (0,0), 'CENTER'), ('BOTTOMPADDING', (0,0), (-1,-1), 2)]))
    story.append(row)
story.append(Spacer(1, 4*mm))
story.append(Paragraph('Verdicts are a model-based interpretation of the evidence (Simulated provenance). The model only saw the evidence listed per segment and every citation was server-checked against it.', qsrc))
story.append(PageBreak())

# ---- P3 verdicts in detail + evidence ----
story.append(Paragraph('Why the model called it this way', h2)); story.append(Spacer(1, 3*mm))
for v in sorted(verdicts, key=lambda x: -(VERDICT[x['verdict']][1] if VERDICT[x['verdict']][1] is not None else -9)):
    pid = v['persona_id']; lab, _ = VERDICT[v['verdict']]
    cited = ', '.join((v['supporting_ids'] or []) + (v['opposing_ids'] or [])) or '—'
    story.append(Paragraph(f"<i>“{v['reaction']}”</i>", quote))
    story.append(Paragraph(f"— {name(pid)} ({BLURBS.get(pid, label(pid)[:18])}) · {lab} · cited: {cited}", qsrc))
    story.append(Spacer(1, 2.5*mm))
story.append(PageBreak())

story.append(Paragraph('What the evidence says', h2))
story.append(Paragraph('Every claim below carries its source ID — comments are verbatim from BMW feedback; study cells cite their exact sheet cell.', tiny))
story.append(Spacer(1, 3*mm))
for sid in sorted(CITED):
    c = CITED[sid]; p = c['payload']
    if c['kind'] == 'study' and sid in ('STUDY-1', 'STUDY-2'):
        story.append(Paragraph(f"<b>{p['attribute']} — {p['metric']} {p['value']:.3f}</b> ({p['market']} {p.get('model','')})", cell))
        story.append(Paragraph(f"{sid} · study cell: {p['source']}", qsrc)); story.append(Spacer(1, 2*mm))
for sid in sorted(CITED):
    c = CITED[sid]
    if c['kind'] != 'comment': continue
    p = c['payload']
    who = 'supports ' + ', '.join(sorted(name(x) for x in c['support'])) if c['support'] else '— supports none'
    against = (' · argues against ' + ', '.join(sorted(name(x) for x in c['oppose']))) if c['oppose'] else ''
    story.append(Paragraph(f"<i>“{p['text']}”</i>", quote))
    bits = [sid, p.get('country') or '?', p.get('engine_type')]
    story.append(Paragraph(' · '.join(b for b in bits if b) + f" — {who}{against}", qsrc))
    story.append(Spacer(1, 2.5*mm))
story.append(Paragraph('Study context cited by the segments', h2)); story.append(Spacer(1, 2*mm))
srows = [['ID', 'Attribute', 'Metric', 'Value', 'Market', 'Source cell']]
for sid in sorted(studies, key=lambda s: int(s.split('-')[1])):
    p = studies[sid]
    srows.append([Paragraph(sid, tiny), Paragraph(p['attribute'], tiny), p['metric'], f"{p['value']:.3f}", p['market'], Paragraph(p['source'], tiny)])
st = Table(srows, colWidths=[18*mm, 48*mm, 15*mm, 12*mm, 14*mm, 57*mm], repeatRows=1)
st.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), INK), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#fff')), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 7.5), ('GRID', (0,0), (-1,-1), .3, HAIR), ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#ffffff'), BG]), ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3)]))
story.append(st)
story.append(PageBreak())

# ---- assumptions + appendix ----
story.append(Paragraph('Assumptions (forward-looking — not evidence)', h2)); story.append(Spacer(1, 2*mm))
seen = set()
for v in verdicts:
    for a in v['assumptions'] or []:
        if a not in seen:
            seen.add(a)
            story.append(Paragraph(f"• {name(v['persona_id'])}: {a}", cell)); story.append(Spacer(1, 1.2*mm))
story.append(Spacer(1, 5*mm))
story.append(Paragraph('Appendix A — full citation map', h2))
story.append(Paragraph('One row per cited ID per segment. Full verbatim text lives in Supabase (feedback_comment.comment_id / study_metric.source_cell); open the run in Backseat → click the segment → evidence drawer for the raw source.', tiny)); story.append(Spacer(1, 2*mm))
arows = [['ID', 'Type', 'For/Against', 'Segments', 'Text / cell (truncated)']]
for sid in sorted(CITED):
    c = CITED[sid]; p = c['payload']
    txt = (p['text'][:110] + '…') if c['kind'] == 'comment' else f"{p['attribute']} {p['metric']}={p['value']:.3f} · {p['source'][:26]}"
    fa = ('both' if c['support'] and c['oppose'] else 'supports' if c['support'] else 'against')
    arows.append([Paragraph(sid, tiny), c['kind'], fa, Paragraph(', '.join(sorted((name(x) for x in (c['support'] | c['oppose'])))), tiny), Paragraph(txt, tiny)])
at = Table(arows, colWidths=[17*mm, 15*mm, 17*mm, 34*mm, 79*mm], repeatRows=1)
at.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), INK), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#fff')), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 7), ('GRID', (0,0), (-1,-1), .3, HAIR), ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#ffffff'), BG]), ('VALIGN', (0,0), (-1,-1), 'TOP'), ('TOPPADDING', (0,0), (-1,-1), 2.5), ('BOTTOMPADDING', (0,0), (-1,-1), 2.5)]))
story.append(at)

doc.build(story)
print('OK', HERE/'backseat-deck-proto.pdf')
