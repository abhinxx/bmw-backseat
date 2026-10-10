#!/usr/bin/env python3
import sys
ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
model, pgs = sys.argv[1], [int(a) for a in sys.argv[2:]]
txt = open(f"{ROOT}/research/data/F_raw_{model}.txt").read()
import re
d = {int(m.group(1)): m.group(2) for m in re.finditer(r"===== PAGE (\d+) =====\n(.*?)(?=\n===== PAGE |\Z)", txt, re.S)}
for p in pgs:
    print(f"\n########## {model} PAGE {p} ##########")
    print(d[p][:2600])
