#!/usr/bin/env python3
"""F: dump row-clusters (top-sorted word bands) for a page to design the matrix parser."""
import sys
import pdfplumber

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
model, pageno = sys.argv[1], int(sys.argv[2])
pdf = pdfplumber.open(f"{ROOT}/BMW-Data/{model}_OptionList.PDF")
page = pdf.pages[pageno - 1]
ws = [w for w in page.extract_words() if w["text"].strip()]
ws.sort(key=lambda w: (w["top"], w["x0"]))
rows = []
for w in ws:
    if rows and abs(w["top"] - rows[-1][0]) <= 2.5 and w["upright"] == rows[-1][1][0]["upright"]:
        rows[-1][1].append(w)
    else:
        rows.append([w["top"], [w]])
for top, wsrc in rows:
    upright = wsrc[0]["upright"]
    parts = " ".join(f"{round(w['x0'])}:{w['text']}" for w in wsrc[:22])
    print(f"t={round(top,1):>6} u={int(upright)} {parts}")
