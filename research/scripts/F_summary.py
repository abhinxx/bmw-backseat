#!/usr/bin/env python3
"""F: focus-feature status per model, derived from F_items.json (output of F_parse_pricelists.py).

Status per (feature, model):
  standard (all N variants) | standard on k/N variants | option EUR x (k/N variants) | in package <name> EUR x
  | not listed (= not found in this price list; the standard pages are 'AUSGEWÄHLTE' = selected items only)
Every hit keeps page + code so it can be traced.

Run:  .venv/bin/python research/scripts/F_summary.py
Out:  research/data/F_focus_features.json, research/data/F_focus_features.md (table)
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "research", "data")
NVAR = {"F70": 6, "G60": 10, "G70": 4}   # variant columns in the equipment grids (verified visually)

FEATURES = [  # (label, regex on item name, regex on package description bullets)
    ("Front seat heating", r"^Sitzheizung (für Fahrer|vorn)", r"Sitzheizung vorn(?! und)"),
    ("Rear seat heating", r"^Sitzheizung vorn und hinten|Sitzheizung.*Fond", r"Sitzheizung vorn und hinten|Sitzheizung.*Fond"),
    ("Front seat ventilation", r"Sitzbelüftung vorn|Aktive Sitzbelüftung$", r"Aktive Sitzbelüftung vorn"),
    ("Rear seat ventilation / massage", r"Sitzbelüftung im Fond|Massage", r"Sitzbelüftung im Fond|Massage"),
    ("Executive Lounge (rear)", r"Executive Lounge", r"Executive Lounge"),
    ("Rear entertainment", r"Fond-Entertainment|Theat", r"Fond-Entertainment|Theat"),
    ("Heated steering wheel", r"^Lenkradheizung", r"Lenkradheizung"),
    ("4-zone climate", r"4-Zonen", r"4-Zonen"),
    ("Head-up display", r"Head-Up", r"Head-Up"),
    ("Panorama glass roof", r"^Panorama.?Glasdach", r"Panorama.?Glasdach"),
    ("Driving Assistant Plus", r"^Driving Assistant Plus", r"Driving Assistant Plus"),
    ("Top driver assistance (DA Professional / Autobahn assistant)",
     r"^Driving Assistant Professional|^Autobahn", r"Driving Assistant Professional|Autobahnassistent"),
    ("Parking Assistant Plus (surround view)", r"^Parking Assistant Plus", r"Parking Assistant Plus|Surround View"),
    ("Parking Assistant Professional", r"^Parking Assistant Professional", r"Parking Assistant Professional"),
    ("harman/kardon audio", r"harman", r"harman"),
    ("Bowers & Wilkins audio", r"Bowers", r"Bowers"),
    ("Comfort access (keyless)", r"^Komfortzugang", r"Komfortzugang"),
    ("Soft-close doors", r"Soft-Close", r"Soft-Close"),
]


def main():
    items = [i for i in json.load(open(os.path.join(D, "F_items.json"))) if not i["condition"]]
    out, md = {}, ["| Feature | F70 (1 Series) | G60 (5 Series) | G70 (7 Series) |", "|---|---|---|---|"]
    for label, rx_name, rx_pkg in FEATURES:
        row = {}
        for m in ("F70", "G60", "G70"):
            mi = [i for i in items if i["model"] == m]
            std = [i for i in mi if i["kind"] == "standard_equipment" and re.search(rx_name, i["name"])]
            opt = [i for i in mi if i["kind"] == "options" and re.search(rx_name, i["name"])]
            pkg = [i for i in mi if i["kind"] == "options" and i["name"].isupper()
                   and re.search(rx_pkg, i["description"])]
            parts, refs = [], []
            for i in std:
                k = sum(1 for v in i["marks"].values() if v == "standard")
                parts.append("standard (all %d)" % NVAR[m] if k == NVAR[m] else "standard on %d/%d" % (k, NVAR[m]))
                refs.append("p%d" % i["page"])
            for i in opt:
                k = len(i["marks"])
                parts.append("option €%s%s" % (format(i["price_gross"], ",.0f") if i["price_gross"] is not None else "?",
                                              "" if k == NVAR[m] else " (%d/%d)" % (k, NVAR[m])))
                refs.append("p%d %s" % (i["page"], i["code"]))
            for i in pkg:
                parts.append("in %s €%s" % (i["name"].title(), format(i["price_gross"], ",.0f")))
                refs.append("p%d %s" % (i["page"], i["code"]))
            row[m] = {"status": "; ".join(dict.fromkeys(parts)) or "not listed", "refs": refs}
        out[label] = row
        md.append("| %s | %s |" % (label, " | ".join("%s <sub>%s</sub>" % (row[m]["status"], ", ".join(row[m]["refs"]))
                                                    if row[m]["refs"] else row[m]["status"] for m in ("F70", "G60", "G70"))))
    json.dump(out, open(os.path.join(D, "F_focus_features.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(D, "F_focus_features.md"), "w").write("\n".join(md) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
