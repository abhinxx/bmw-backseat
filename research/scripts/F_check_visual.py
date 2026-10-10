#!/usr/bin/env python3
"""Regression check for F_parse_pricelists.py against values read by eye from rendered PDF pages
(research/data/F_pages/*.png, re-render with pdfplumber page.to_image if missing).

Run after the parser:  .venv/bin/python research/scripts/F_check_visual.py   (exit 1 on any mismatch)
Marks string = one char per variant column in page order: ■ standard, □ optional, . not offered.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "research", "data")
COLS = {
    "F70": ["118d", "120d", "116", "120", "123 xDrive", "M135 xDrive"],
    "G60": ["i5 eDrive40", "i5 xDrive40", "i5 M60 xDrive", "530e", "530e xDrive", "550e xDrive",
            "520i", "520d", "520d xDrive", "540d xDrive"],
    "G70": ["i7 50xDrive", "i7 60xDrive", "740 xDrive", "i7 M70 xDrive"],
}
# (model, page, code, price_gross, marks, condition-or-None, name-prefix)
EXPECTED_ITEMS = [
    ("F70", 14, "668", None, "■■■■■.", None, "Schwarz uni"),
    ("F70", 14, "300", 270.0, "□□□□□■", None, "Alpinweiß uni"),
    ("F70", 14, "C31", 780.0, "□□□□□□", None, "M Portimao Blau"),
    ("F70", 14, "C5Y", 780.0, "□□□□□□", None, "Cape York Grün"),
    ("F70", 14, "C6R", 2250.0, "□□□□□□", None, "BMW Individual Frozen Portimao Blue"),
    ("F70", 14, "U490", 3900.0, "□□□□□□", None, "BMW Individual Sonderlackierung"),
    ("F70", 17, "248", 250.0, "□□□□□□", None, "Lenkradheizung"),
    ("F70", 17, "2TE", 0.0, "□□□□□■", None, "Steptronic Getriebe mit Doppelkupplung"),
    ("F70", 17, "5DW", 250.0, ".□.□□.", None, "Parking Assistant Professional"),
    ("G60", 18, "2VV", 2440.0, "□■■□□■□□□□", None, "Adaptives Fahrwerk Professional"),
    ("G60", 18, "2VV", 1990.0, "□..□□.□□□□", "In Verbindung mit M Sportpaket", "Adaptives Fahrwerk"),
    ("G60", 18, "2VW", 4100.0, ".□□..□....", None, "Adaptives M Fahrwerk Professional"),
    ("G60", 18, "5AT", 1000.0, "□□□□□□□□□□", None, "Driving Assistant Plus"),
    ("G60", 18, "5AU", 2100.0, "□□□□□□□□□□", None, "Driving Assistant Professional"),
    ("G60", 18, "5AX", 850.0, "□□□□□□□□□□", None, "Autobahnassistent"),
    ("G60", 18, "5DW", 1150.0, "□□□□□□□□□□", None, "Parking Assistant Professional"),
    ("G60", 18, "5DW", 350.0, "□□□□□□□□□□", "In Verbindung mit Innovationspaket", "Parking Assistant"),
    ("G60", 18, "456", 930.0, "□□□□□□□□□□", None, "Komfortsitze vorn"),
    ("G60", 15, "300", None, "■■■■■■■■■■", None, "Alpinweiß"),
    ("G60", 15, "475", 1120.0, "□□□□□□□□□□", None, "Saphirschwarz"),
    ("G60", 15, "C68", 1120.0, "□□□□□□□□□□", None, "Fire Red metallic"),
    ("G60", 15, "C3Z", 2140.0, "□□□□□□□□□□", None, "BMW Individual Tansanitblau"),
    ("G60", 15, "X1E", 5900.0, "□□□□□□□□□□", None, "BMW Individual Frozen Portimao"),
    ("G60", 6, None, None, "■■■■■■■■■■", None, "BMW Live Cockpit Plus"),
    ("G60", 6, None, None, "......■■■■", None, "18\" Leichtmetallräder Y-Speiche 932"),
    ("G60", 6, None, None, "..■.......", None, "M SPORTPAKET PRO"),
    ("G70", 21, "4F4", 2200.0, "□□□□", None, "Executive Lounge Seating"),
    ("G70", 21, "775", 0.0, "□□□■", None, "M Dachhimmel Anthrazit"),
    ("G70", 21, "776", 1200.0, "...□", "variant-specific price", "M Dachhimmel Alcantara anthrazit"),
    ("G70", 21, "6F1", 6050.0, "□□□□", None, "Bowers & Wilkins Diamond Surround"),
    ("G70", 21, "2Z2", 4300.0, ".□..", None, "Adaptive Chassis Control Professional"),
    ("G70", 21, "3M3", 700.0, "□□□■", None, "M Sportbremse, schwarz metallic"),
]
EXPECTED_VARIANTS = [  # (model, variant, kW, PS, base price gross) from G60 p5 and G70 p4
    ("G60", "520i", 153, 208, 60000.0), ("G60", "520d", 145, 197, 62300.0),
    ("G60", "520d xDrive", 145, 197, 64900.0), ("G60", "540d xDrive", 223, 303, 71900.0),
    ("G60", "i5 eDrive40", 250, 340, 70900.0), ("G70", "i7 50xDrive", 335, 455, 121400.0),
    ("G70", "i7 60xDrive", 400, 544, 140100.0), ("G70", "i7 M70 xDrive", 500, 680, 182400.0),
    ("G70", "750e xDrive", 360, 489, 133900.0), ("G70", "M760e xDrive", 450, 612, 159900.0),
]


def main():
    items = json.load(open(os.path.join(D, "F_items.json")))
    variants = json.load(open(os.path.join(D, "F_variants.json")))
    sym = {"standard": "■", "optional": "□"}
    fails = 0
    for m, p, code, price, marks, cond, name in EXPECTED_ITEMS:
        cands = [i for i in items if i["model"] == m and i["page"] == p and i["code"] == code
                 and (i["condition"] or None) == cond and i["name"].startswith(name)]
        got = [("".join(sym.get(i["marks"].get(v), ".") for v in COLS[m]), i["price_gross"]) for i in cands]
        if (marks, price) not in got:
            fails += 1
            print("FAIL item %s p%d %s %r: expected %s %s, got %s" % (m, p, code, name, marks, price, got))
    for m, v, kw, ps, price in EXPECTED_VARIANTS:
        if not any(x["model"] == m and x["variant"] == v and x["power_kw"] == kw and x["power_ps"] == ps
                   and x["base_price_eur_gross"] == price for x in variants):
            fails += 1
            print("FAIL variant %s %s: expected %s kW %s PS %s EUR" % (m, v, kw, ps, price))
    total = len(EXPECTED_ITEMS) + len(EXPECTED_VARIANTS)
    print("visual check: %d/%d passed" % (total - fails, total))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
