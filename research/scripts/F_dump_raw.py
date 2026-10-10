#!/usr/bin/env python3
"""F: dump raw per-page text of the three BMW option-list PDFs to research/data/F_raw_<model>.txt
and a first-pass page-map (extract_tables availability + first lines per page)."""
import json, os, sys
import pdfplumber

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
PDFS = {"F70": "F70_OptionList.PDF", "G60": "G60_OptionList.PDF", "G70": "G70_OptionList.PDF"}
OUT = os.path.join(ROOT, "research", "data")
os.makedirs(OUT, exist_ok=True)

pagemap = {}
for model, fname in PDFS.items():
    path = os.path.join(ROOT, "BMW-Data", fname)
    raw_path = os.path.join(OUT, f"F_raw_{model}.txt")
    pm = []
    with open(raw_path, "w", encoding="utf-8") as raw, pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            txt = page.extract_text() or ""
            ntab = len(page.extract_tables())
            raw.write(f"\n===== PAGE {i} =====\n{txt}\n")
            lines = [l.strip() for l in txt.splitlines() if l.strip()]
            pm.append({
                "page": i,
                "n_lines": len(lines),
                "n_tables": ntab,
                "head": " | ".join(lines[:4])[:180],
            })
    pagemap[model] = pm
    print(model, "pages:", len(pm), "->", raw_path)

with open(os.path.join(OUT, "F_pagemap_raw.json"), "w", encoding="utf-8") as f:
    json.dump(pagemap, f, ensure_ascii=False, indent=1)
print("done")
