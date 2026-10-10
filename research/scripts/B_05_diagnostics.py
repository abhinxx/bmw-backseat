"""B_05: Diagnostics — taxonomy label search corrections, multilingual, quality checks.

Run from project root. Writes research/data/B_g70_diag.json.
"""
import pandas as pd, json, pathlib, unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pd.read_pickle(OUT / "B_g70.pkl")
res = {}

# 1. taxonomy labels mentioning heat/ventil/seat/colour/paint/rear/lounge/entertain
tax2 = df["Vfc level2 Name"].fillna("(missing)").astype(str)
tax3 = df["Vfc level3 Name"].fillna("(missing)").astype(str)
def labels_with(words):
    m = pd.Series(False, index=df.index)
    for w in words:
        m |= tax2.str.lower().str.contains(w) | tax3.str.lower().str.contains(w)
    return sorted(set(tax2[m] + " || " + tax3[m]))
res["tax_heat"] = labels_with(["heat", "ventil", "clima"])[:20]
res["tax_seat"] = labels_with(["seat"])[:20]
res["tax_colour"] = labels_with(["colou", "color", "paint"])[:20]
res["tax_rear"] = labels_with(["rear", "lounge", "entertain", "theatr"])[:20]

# corrected taxonomy matches (uid):
def tax_uid(words, neg_only=False):
    m = pd.Series(False, index=df.index)
    for w in words:
        m |= tax2.str.lower().str.contains(w) | tax3.str.lower().str.contains(w)
    s = df[m]
    if neg_only: s = s[s["Feedback Type"].isin(["Difficult to Use", "Defect"])]
    return s
seat_hv = tax_uid(["heat", "ventil"])  # includes steering wheel heat — split:
res["tax_seatheating_uid"] = int(tax_uid(["seat heat", "seat ventil", "seat clima"]).ID.nunique())
res["tax_steeringheat_uid"] = int(tax_uid(["heated steering"]).ID.nunique())
res["tax_paint_label_hits"] = {lbl: int(df[(tax2.str.lower()+ "||" + tax3.str.lower()).str.contains(lbl.lower(), regex=False)].ID.nunique()) for lbl in res["tax_colour"][:10]}
res["tax_rear_uid"] = int(tax_uid(["rear seat", "executive lounge", "theatr"]).ID.nunique())

# 2. multilingual: share of texts with non-Latin script chars
def nonlatin_frac(t):
    txt = str(t)
    nz = [c for c in txt if unicodedata.category(c).startswith("L") and not ("A" <= c.upper() <= "Z")]
    return len(nz) / max(len(txt), 1)
df["nl"] = df["Customer Feedback"].map(nonlatin_frac)
res["texts_gt20pct_nonlatin"] = int((df["nl"] > 0.2).sum())
res["ids_gt20pct_nonlatin"] = int(df[df["nl"] > 0.2]["ID"].nunique())
res["nonlatin_by_country"] = df[df["nl"] > 0.2].groupby("Country")["ID"].nunique().to_dict()

# 3. quality checks
res["text_len_stats"] = {p: int(df["Customer Feedback"].astype(str).str.len().quantile(p)) for p in [0, 0.05, 0.25, 0.5, 0.9, 0.99, 1]}
res["rows_text_short_lt10"] = int((df["Customer Feedback"].astype(str).str.len() < 10).sum())
# (None) feedback type rows: relation to no_class_found/missing
none_rows = df[df["Feedback Type"].isna()]
res["fbtype_none_rows"] = int(len(none_rows))
res["fbtype_none_and_taxmissing"] = int(len(none_rows[none_rows["Vfc level2 Name"].isna() | (none_rows["Vfc level2 Name"].astype(str) == "no_class_found")]))
res["fbtype_none_uid"] = int(none_rows.ID.nunique())
# duplicate full rows (same ID + same level2 + same level3)?
dupfull = df.duplicated(subset=["ID", "Vfc level2 Name", "Vfc level3 Name", "Feedback Type"]).sum()
res["exact_dupe_rows"] = int(dupfull)
# shared texts across IDs (6 earlier) — show
t = df.groupby("Customer Feedback")["ID"].nunique()
sh = t[t > 1]
res["shared_texts"] = [{"text": str(k)[:80], "n_ids": int(v)} for k, v in sh.items()]
# engine 'BEVE' naming oddity
res["engine_labels"] = sorted(df["Engine Type"].dropna().unique().tolist())
# Source A rows-per-id (1383 rows/695 ids = 2.0) — is A double-coded?
a = df[df.Source == "Source A"]
res["sourceA"] = {"rows": len(a), "uids": int(a.ID.nunique()),
  "mean_rows": round(len(a)/a.ID.nunique(), 2),
  "fbtype_mix": a.groupby(a["Feedback Type"].fillna("(None)"))["ID"].nunique().to_dict()}
b = df[df.Source == "Source B"]
res["sourceB"] = {"rows": len(b), "uids": int(b.ID.nunique()),
  "fbtype_mix": b.groupby(b["Feedback Type"].fillna("(None)"))["ID"].nunique().to_dict()}
for src in ["Source C", "Source D"]:
    s = df[df.Source == src]
    res[src] = {"rows": len(s), "uids": int(s.ID.nunique()),
      "fbtype_mix": s.groupby(s["Feedback Type"].fillna("(None)"))["ID"].nunique().to_dict(),
      "no_class_rows": int((s["Vfc level2 Name"].astype(str) == "no_class_found").sum())}
# Wants rows by country (PM regional ask)
res["wants_by_country"] = df[df["Feedback Type"] == "Wants"].groupby("Country")["ID"].nunique().to_dict()
(OUT / "B_g70_diag.json").write_text(json.dumps(res, indent=1, ensure_ascii=False, default=str))
print(json.dumps(res, indent=1, ensure_ascii=False, default=str)[:3500])
