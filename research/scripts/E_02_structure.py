# E_02: structural analysis of both sheets.
# - CN_EU_2025: confirm header rows, all block titles, trailing rows 77-84, empty cols G-M.
# - US_2025: parse every block (title + Sample total + levels), list distinct level sets,
#   check every column used, check block regularity, check sums=1.
import openpyxl, json
from collections import Counter, defaultdict

SRC = "BMW-Data/F70_G60_G68_G70_customer_studies.xlsx"
wb = openpyxl.load_workbook(SRC, data_only=True)

report = {}

# ---- CN_EU_2025 ----
ws = wb["CN_EU_2025"]
cn_eu = {"max_row": ws.max_row, "max_col": ws.max_column}
grid = {c.coordinate: c.value for row in ws.iter_rows() for c in row if c.value is not None}
# which columns have data anywhere
col_has = defaultdict(list)
for coord, v in grid.items():
    col = coord.rstrip("0123456789")
    col_has[col].append(coord)
cn_eu["cols_with_data"] = {k: len(v) for k, v in sorted(col_has.items())}
# rows 1-3 full
cn_eu["header_rows"] = {r: {c.coordinate: c.value for c in ws[r] if c.value is not None} for r in (1, 2, 3)}
# trailing rows 77-84
cn_eu["trailing_rows"] = {r: {c.coordinate: c.value for c in ws[r] if c.value is not None} for r in range(77, 85)}
# blocks: title in col A on rows where next row A=='Mean'
blocks = []
r = 3
while r <= ws.max_row:
    a = ws.cell(row=r, column=1).value
    b = ws.cell(row=r + 1, column=1).value if r + 1 <= ws.max_row else None
    if a and b == "Mean":
        vals = {ws.cell(row=r+1, column=col).coordinate: ws.cell(row=r+1, column=col).value for col in range(2, 7)}
        blocks.append({"title_row": r, "title": a, "mean_row": r + 1, "values": vals})
        r += 2
    else:
        if a is not None:
            blocks.append({"UNEXPECTED_row": r, "A": a, "rest": {c.coordinate: c.value for c in ws[r] if c.value is not None}})
        r += 1
cn_eu["n_blocks"] = len(blocks)
cn_eu["blocks"] = blocks
# value ranges
allvals = [v for b in blocks if "values" in b for v in b["values"].values() if isinstance(v, (int, float))]
cn_eu["value_min"] = min(allvals); cn_eu["value_max"] = max(allvals); cn_eu["n_values"] = len(allvals)
# any None in mean cells?
cn_eu["missing_mean_cells"] = [k for b in blocks if "values" in b for k, v in b["values"].items() if v is None]
report["CN_EU_2025"] = cn_eu

# ---- US_2025 ----
ws = wb["US_2025"]
us = {"max_row": ws.max_row, "max_col": ws.max_column}
cols_used = Counter()
for row in ws.iter_rows():
    for c in row:
        if c.value is not None:
            cols_used[c.coordinate.rstrip("0123456789")] += 1
us["cols_used"] = dict(cols_used)
us["header_row1"] = {c.coordinate: c.value for c in ws[1] if c.value is not None}
# parse blocks: title row where A=title, next row A=='Sample total'
ublocks = []
oddities = []
r = 1
while r <= ws.max_row:
    a = ws.cell(row=r, column=1).value
    a2 = ws.cell(row=r + 1, column=1).value if r + 1 <= ws.max_row else None
    if a is not None and a2 == "Sample total":
        # levels follow until next non-level row
        rr = r + 2
        levels = []
        while rr <= ws.max_row:
            lab = ws.cell(row=rr, column=1).value
            if lab in (None, "Sample total") or (ws.cell(row=rr+1, column=1).value == "Sample total"):
                break
            if lab is None:
                break
            nxt = ws.cell(row=rr + 1, column=1).value
            # stop if this looks like a new title (i.e., the row after it is Sample total)
            levels.append({"row": rr, "label": lab,
                           "metric": ws.cell(row=rr, column=2).value,
                           "G60": ws.cell(row=rr, column=3).value,
                           "G70": ws.cell(row=rr, column=4).value,
                           "E": ws.cell(row=rr, column=5).value})
            rr += 1
        ublocks.append({"title_row": r, "title": a, "levels": levels,
                        "sample_total_row": r + 1,
                        "sample_total": {"metric": ws.cell(row=r+1, column=2).value,
                                          "G60": ws.cell(row=r+1, column=3).value,
                                          "G70": ws.cell(row=r+1, column=4).value}})
        r = rr
    else:
        if a is not None:
            oddities.append({"row": r, "A": a})
        r += 1
us["n_blocks"] = len(ublocks)
us["oddity_rows"] = oddities
level_sets = Counter(tuple(l["label"] for b in ublocks for l in b["levels"]))
us["distinct_level_sequences"] = {" | ".join(k): v for k, v in level_sets.items()}
metric_labels = Counter(l["metric"] for b in ublocks for l in b["levels"] if l["metric"] is not None)
us["metric_labels"] = dict(metric_labels)
# sums check
sums = []
for b in ublocks:
    for model in ("G60", "G70"):
        s = sum(l[model] for l in b["levels"] if isinstance(l[model], (int, float)))
        sums.append((b["title"], model, round(s, 6)))
bad = [t for t in sums if abs(t[2] - 1.0) > 0.001]
us["sums_off_1"] = bad
us["n_blocks_checked"] = len(sums)
# E column anywhere?
e_vals = [(l["row"], l["label"], l["E"]) for b in ublocks for l in b["levels"] if l["E"] is not None]
us["E_column_nonempty"] = e_vals[:20] + ([f"...total {len(e_vals)}"] if len(e_vals) > 20 else [])
# values range
uvals = [l[m] for b in ublocks for l in b["levels"] for m in ("G60", "G70") if isinstance(l[m], (int, float))]
us["value_min"] = min(uvals); us["value_max"] = max(uvals); us["n_values"] = len(uvals)
# titles list
us["titles"] = [(b["title_row"], b["title"]) for b in ublocks]
report["US_2025"] = us

with open("research/data/E_structure_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=1, ensure_ascii=False, default=str)

# console summary
print("CN_EU blocks:", cn_eu["n_blocks"], "cols:", cn_eu["cols_with_data"])
print("CN_EU trailing:", json.dumps(cn_eu["trailing_rows"], default=str))
print("CN_EU value range:", cn_eu["value_min"], "-", cn_eu["value_max"], "missing:", cn_eu["missing_mean_cells"])
print("US blocks:", us["n_blocks"], "cols used:", us["cols_used"])
print("US distinct level sequences:", json.dumps(us["distinct_level_sequences"], indent=1))
print("US oddities:", oddities[:10], "count:", len(oddities))
print("US sums off 1:", bad[:10], "count:", len(bad))
print("US E col:", us["E_column_nonempty"][:5] if us["E_column_nonempty"] else "EMPTY")
print("US metric labels:", us["metric_labels"])
print("US value range:", us["value_min"], "-", us["value_max"], "n:", us["n_values"])
