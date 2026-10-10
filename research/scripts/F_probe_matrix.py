#!/usr/bin/env python3
"""F: positional word analysis of matrix pages to recover variant column headers
and the x-ranges of the availability columns (marked with ■/□ glyphs)."""
import sys, json
import pdfplumber

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
model = sys.argv[1]; pageno = int(sys.argv[2])
pdf = pdfplumber.open(f"{ROOT}/BMW-Data/{model}_OptionList.PDF")
page = pdf.pages[pageno - 1]
ws = page.extract_words(keep_blank_chars=False, extra_attrs=["upright"])
boxes = [w for w in ws if w["text"] in ("■", "□")]
print("page size:", page.width, page.height)
print("boxes x-centers:", sorted({round((b['x0']+b['x1'])/2) for b in boxes}))
# header zone: top < first option line. Print all words with top in header band
tops = sorted({round(w['top']) for w in ws})
hdr_max = min([b['top'] for b in boxes], default=200)
print("first box top:", hdr_max)
for w in sorted(ws, key=lambda w: (round(w['top']), w['x0'])):
    if w['top'] < hdr_max + 2:
        print(round(w['top'], 1), round(w['x0'], 1), round(w['x1'], 1), w['upright'], repr(w['text']))
