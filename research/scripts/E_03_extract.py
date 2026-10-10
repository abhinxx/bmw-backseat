# E_03: tidy long-format extraction + computed metrics + anomaly checks.
# Fixes E_02 parser bug: rows 867 & 877 are blank rows inside blocks (skip blanks).
# Outputs: research/data/E_studies_long.csv, research/data/E_studies.json
import openpyxl, csv, json
from collections import defaultdict

SRC = "BMW-Data/F70_G60_G68_G70_customer_studies.xlsx"
wb = openpyxl.load_workbook(SRC, data_only=True)
rows = []          # long format
anoms = []

# ---------- CN_EU_2025 (means) ----------
ws = wb["CN_EU_2025"]
# header: row2 dataset country at B2(China),D2(EU); row3 model names B3:F3
markets = {}
model_cols = {}
for col in range(2, 7):
    model_cols[col] = ws.cell(row=3, column=col).value.strip()
# country per column: China = B,C ; EU = D,E,F (from merged-looking row2 labels B2,D2)
country_of = {}
cur = None
for col in range(2, 7):
    v = ws.cell(row=2, column=col).value
    if v: cur = v
    country_of[col] = cur

r = 3
cn_blocks = []
while r <= ws.max_row:
    title = ws.cell(row=r, column=1).value
    if title and ws.cell(row=r+1, column=1).value == "Mean":
        cn_blocks.append((r, title, r+1))
        r += 2
    else:
        r += 1
for tr, title, mr in cn_blocks:
    for col in range(2, 7):
        cell = ws.cell(row=mr, column=col)
        rows.append({
            "sheet": "CN_EU_2025", "market": country_of[col],
            "model": model_cols[col], "attribute": title,
            "metric": "mean", "value": cell.value,
            "n_if_available": "",  # no sample sizes present anywhere in sheet
            "source_cell": f"CN_EU_2025!{cell.coordinate}",
        })

# ---------- US_2025 (shares) ----------
ws = wb["US_2025"]
LVL_ORDER = ["I Hate It", "A Failure", "Unsatisfactory", "Satisfactory",
             "Excellent", "Delightful", "I Love It"]  # ascending (row order, 1=worst .. 7=best)
us_blocks = []
r = 1
blank_inside = []
while r <= ws.max_row:
    title = ws.cell(row=r, column=1).value
    nxt = ws.cell(row=r+1, column=1).value if r+1 <= ws.max_row else None
    if title is not None and nxt == "Sample total":
        st_row = r+1
        levels = {}
        rr = st_row + 1
        while rr <= ws.max_row and len(levels) < 7:
            lab = ws.cell(row=rr, column=1).value
            if lab is None:
                blank_inside.append(rr); rr += 1; continue
            if lab in LVL_ORDER:
                levels[lab] = {"row": rr,
                               "G60": ws.cell(row=rr, column=3).value,
                               "G70": ws.cell(row=rr, column=4).value}
                rr += 1
            else:
                break
        us_blocks.append({"title_row": r, "title": str(title).strip(), "st_row": st_row, "levels": levels})
        r = rr
    else:
        r += 1

for b in us_blocks:
    for model, col in (("G60", 3), ("G70", 4)):
        stv = ws.cell(row=b["st_row"], column=col).value
        stcell = ws.cell(row=b["st_row"], column=col).coordinate
        rows.append({"sheet": "US_2025", "market": "US", "model": model,
                     "attribute": b["title"], "metric": "sample_total_share",
                     "value": stv, "n_if_available": "",
                     "source_cell": f"US_2025!{stcell}"})
        share = {}
        for lab, d in b["levels"].items():
            v = d[model]
            cell = ws.cell(row=d["row"], column=col).coordinate
            share[lab] = v if isinstance(v, (int, float)) else None
            rows.append({"sheet": "US_2025", "market": "US", "model": model,
                         "attribute": b["title"], "metric": f"share_{lab.lower().replace(' ', '_')}",
                         "value": v, "n_if_available": "",
                         "source_cell": f"US_2025!{cell}"})
        if len(share) == 7 and all(v is not None for v in share.values()):
            s = sum(share.values())
            if abs(s - 1.0) > 0.005:
                anoms.append({"kind": "share_sum_off_1", "block": b["title"], "model": model,
                              "sum": round(s, 4), "first_cell": f"US_2025!C{b['title_row']}"})
            top1 = share["I Love It"]
            top2 = share["Delightful"] + top1
            top3 = share["Excellent"] + top2
            bot1 = share["I Hate It"]
            bot2 = bot1 + share["A Failure"]
            bot3 = bot2 + share["Unsatisfactory"]
            imp_mean = sum(share[l] * (i + 1) for i, l in enumerate(LVL_ORDER))
            for mname, mval in (("top1box", top1), ("top2box", top2), ("top3box", top3),
                               ("bottom1box", bot1), ("bottom2box", bot2), ("bottom3box", bot3),
                               ("mean_from_shares_1to7", imp_mean)):
                rows.append({"sheet": "US_2025", "market": "US", "model": model,
                             "attribute": b["title"], "metric": mname,
                             "value": round(mval, 6), "n_if_available": "",
                             "source_cell": f"COMPUTED from US_2025 rows {b['levels'][LVL_ORDER[0]]['row']}-{b['levels'][LVL_ORDER[-1]]['row']} col {'C' if model=='G60' else 'D'}"})

# ---------- anomaly checks ----------
# blank rows inside blocks
anoms.append({"kind": "blank_rows_inside_us_blocks", "rows": sorted(set(blank_inside))})
# decimals: CN/EU means full float precision? count decimals
cn_vals = [rr["value"] for rr in rows if rr["sheet"] == "CN_EU_2025"]
import decimal
def dec_places(v):
    s = repr(float(v))
    return len(s.split(".")[1]) if "." in s and s.split(".")[1] != "0" else 0
import statistics
cn_dp = [dec_places(v) for v in cn_vals]
us_share_vals = [rr["value"] for rr in rows if rr["sheet"] == "US_2025" and rr["metric"].startswith("share_")]
us_dp = [dec_places(v) for v in us_share_vals]
anoms.append({"kind": "decimal_precision", "cn_eu_mean_deciles_min_max_mode": [min(cn_dp), max(cn_dp), statistics.mode(cn_dp)],
              "us_share_distinct_dp": sorted(set(us_dp))})
# duplicate attribute titles within a sheet
def dupes(sheet):
    seen = defaultdict(int)
    for rr in rows:
        if rr["sheet"] == sheet and rr["metric"] in ("mean", "share_i_hate_it"):
            seen[rr["attribute"]] += 1
    return {k: v for k, v in seen.items() if v > 1}
anoms.append({"kind": "duplicate_attribute_titles", "CN_EU_2025": dupes("CN_EU_2025"), "US_2025": dupes("US_2025")})
# G70 tail pattern: compute bottom1box for last 10 US blocks G70 vs G60
tail = [b for b in us_blocks][-12:]
tail_cmp = []
for b in tail:
    def bx(model, col):
        vals = {lab: b["levels"][lab][model] for lab in LVL_ORDER}
        return round(vals["I Hate It"], 3)
    tail_cmp.append({"title": b["title"][:50], "G60_i_hate_it": bx("G60", None), "G70_i_hate_it": bx("G70", None)})
anoms.append({"kind": "us_tail_high_bottom_blocks", "blocks": tail_cmp})

# ---------- write CSV ----------
with open("research/data/E_studies_long.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["sheet", "market", "model", "attribute", "metric", "value", "n_if_available", "source_cell"])
    w.writeheader()
    w.writerows(rows)

# ---------- computed summaries -> JSON ----------
summary = {"n_rows_long": len(rows), "anomalies": anoms}
# US per-model rankings on top2box
us_by_model = defaultdict(dict)
for rr in rows:
    if rr["sheet"] == "US_2025" and rr["metric"] in ("top2box", "top1box", "bottom2box", "mean_from_shares_1to7"):
        us_by_model[rr["model"]].setdefault(rr["metric"], {})[rr["attribute"]] = rr["value"]
summary["US_rankings"] = {}
for model, mets in us_by_model.items():
    t2 = sorted(mets["top2box"].items(), key=lambda kv: -kv[1])
    b2 = sorted(mets["bottom2box"].items(), key=lambda kv: -kv[1])
    summary["US_rankings"][model] = {
        "top15_top2box": t2[:15], "bottom15_top2box": t2[-15:],
        "top15_bottom2box_worst": b2[:15],
        "n_attributes": len(t2),
    }
# G60 vs G70 deltas on top2box
common = set(us_by_model["G60"]["top2box"]) & set(us_by_model["G70"]["top2box"])
delta = sorted(((a, round(us_by_model["G60"]["top2box"][a] - us_by_model["G70"]["top2box"][a], 4)) for a in common),
               key=lambda kv: -abs(kv[1]))
summary["US_top2box_G60_minus_G70_largest"] = delta[:20]
# CN/EU table pivot + G70 China vs EU
cn = defaultdict(dict)
for rr in rows:
    if rr["sheet"] == "CN_EU_2025":
        cn[rr["attribute"]][f"{rr['market']}|{rr['model']}"] = rr["value"]
g70 = []
for a, d in cn.items():
    if "China|BMW 7 Series G70" in d and "EU|BMW 7 Series G70" in d:
        g70.append((a, round(d["China|BMW 7 Series G70"], 3), round(d["EU|BMW 7 Series G70"], 3),
                    round(d["China|BMW 7 Series G70"] - d["EU|BMW 7 Series G70"], 3)))
summary["CN_EU_G70_China_minus_EU_sorted"] = sorted(g70, key=lambda t: -abs(t[3]))
summary["CN_EU_attributes"] = sorted(cn.keys())
summary["CN_EU_blocks"] = [t for _, t, _ in [(b[0], b[1], b[2]) for b in cn_blocks]]
with open("research/data/E_studies.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=1, ensure_ascii=False)

print("long rows:", len(rows), "us blocks:", len(us_blocks), "cn blocks:", len(cn_blocks))
print("blank rows inside blocks:", sorted(set(blank_inside)))
print("sum anomalies:", [a for a in anoms if a["kind"] == "share_sum_off_1"])
print("dp:", anoms[-3] if anoms[-3]["kind"]=="decimal_precision" else [a for a in anoms if a["kind"]=="decimal_precision"])
print("dupes:", [a for a in anoms if a["kind"] == "duplicate_attribute_titles"])
for m, s in summary["US_rankings"].items():
    print(m, "n_attr", s["n_attributes"], "best3", s["top15_top2box"][:3], "worst3", s["bottom15_top2box"][-3:])
