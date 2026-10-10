"""B_02: Core aggregates for report B. Counts on rows AND unique IDs.

Run from project root. Writes research/data/B_g70_core.json.
Definitions used throughout:
  - unique-ID count = df[df.ID.isin(id_set)] computed via groupby on ID-deduped frame.
  - For a category X: uid(X) = # distinct IDs having >=1 row with X.
"""
import pandas as pd, json, pathlib, numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pd.read_pickle(OUT / "B_g70.pkl")

def clean(s):
    return s.astype(str).str.strip() if s.dtype == object else s

res = {}
# 1. counts
res["counts"] = {
    "rows": int(len(df)),
    "unique_ids": int(df["ID"].nunique()),
    "unique_feedback_texts": int(df["Customer Feedback"].nunique()),
    "rows_per_id_mean": round(len(df) / df["ID"].nunique(), 3),
}
# IDs appearing in >1 row
id_counts = df.groupby("ID").size()
res["counts"]["ids_in_1_row"] = int((id_counts == 1).sum())
res["counts"]["ids_in_multi_rows"] = int((id_counts > 1).sum())
res["counts"]["max_rows_per_id"] = int(id_counts.max())
# multi-row id examples where category differs
dup_ids = id_counts[id_counts > 1].index[:400]
examples = []
for i in dup_ids:
    sub = df[df.ID == i]
    if sub["Vfc level2 Name"].nunique(dropna=True) > 1:
        examples.append(sub[["ID","Feedback Type","Vfc level2 Name","Vfc level3 Name","Customer Feedback"]].to_dict("records"))
        if len(examples) >= 2: break
res["duplication_examples"] = examples
# same-text-different-ID check
t = df.groupby("Customer Feedback")["ID"].nunique()
res["counts"]["texts_shared_by_multiple_ids"] = int((t > 1).sum())

# 2. distributions (rows + uid)
def dist(col):
    rows = df[col].value_counts(dropna=False).rename("rows")
    uid = df.groupby(col)["ID"].nunique().rename("unique_ids")
    out = pd.concat([rows, uid], axis=1).reset_index()
    out.columns = [col if col == out.columns[0] else out.columns[0], "rows", "unique_ids"]
    return out.fillna("(None)")
for col in ["Source", "Country", "Engine Type", "Feedback Type"]:
    res[f"dist_{col.replace(' ','')}"] = dist(col).astype({c: str for c in ["Source","Country","Engine Type","Feedback Type"] if c in dist(col).columns}).to_dict("records")

# crosstabs (unique IDs: an ID can appear in multiple cells if its rows span countries/sources; verify)
res["id_country_unique"] = bool(df.groupby("ID")["Country"].nunique().max() == 1)
res["id_source_unique"] = bool(df.groupby("ID")["Source"].nunique().max() == 1)
res["id_engine_unique"] = bool(df.groupby("ID")["Engine Type"].nunique().max() == 1)
ct = df.groupby(["Source","Country"])["ID"].nunique().reset_index(name="unique_ids")
res["crosstab_source_country"] = ct.to_dict("records")
ct2 = df.groupby(["Country","Engine Type"])["ID"].nunique().reset_index(name="unique_ids")
res["crosstab_country_engine"] = ct2.to_dict("records")

# 3. taxonomy: top level2 by unique-ID count with like/dislike split
d = df.copy()
d["Vfc level2 Name"] = d["Vfc level2 Name"].fillna("(missing)")
# per-ID dedup for taxonomy counting: each ID counted once per level2 category
idcat = d[["ID","Vfc level2 Name","Feedback Type"]].drop_duplicates()
def fb_group(x):
    x = str(x)
    if "Dislike" in x: return "Dislikes"
    if "Like" in x: return "Likes"
    return x if x != "nan" else "(None)"
idcat["fb"] = idcat["Feedback Type"].map(fb_group)
top = idcat.groupby("Vfc level2 Name")["ID"].nunique().sort_values(ascending=False)
split = idcat.pivot_table(index="Vfc level2 Name", columns="fb", values="ID", aggfunc=pd.Series.nunique, fill_value=0)
tab = []
for cat in top.index[:25]:
    row = {"level2": cat, "unique_ids": int(top[cat])}
    for k in ["Likes","Dislikes"]:
        row[k] = int(split.loc[cat, k]) if k in split.columns else 0
    for k in split.columns:
        if k not in ("Likes","Dislikes"):
            row[f"other_{k}"] = int(split.loc[cat, k])
    tab.append(row)
res["top25_level2"] = tab
# unclassified rate: rows and IDs where level2 missing OR 'no_class_found'
mask_missing = d["Vfc level2 Name"] == "(missing)"
mask_noclass = d["Vfc level2 Name"].astype(str).str.lower().str.contains("no_class_found")
res["unclassified"] = {
    "rows_missing_level2": int(mask_missing.sum()),
    "rows_no_class_found": int(mask_noclass.sum()),
    "ids_fully_unclassified": int(len(set(d[mask_missing|mask_noclass].ID) - set(d[~(mask_missing|mask_noclass)].ID))),
    "ids_any_unclassified_row": int(d[mask_missing|mask_noclass]["ID"].nunique()),
    "pct_ids_any_unclassified_row": round(100*d[mask_missing|mask_noclass]["ID"].nunique()/df["ID"].nunique(),1),
}
# level3 distribution top
l3 = df.groupby(df["Vfc level3 Name"].fillna("(missing)"))["ID"].nunique().sort_values(ascending=False)
res["top_level3"] = [{"level3": k, "unique_ids": int(v)} for k, v in l3.head(20).items()]

(OUT / "B_g70_core.json").write_text(json.dumps(res, indent=1, ensure_ascii=False, default=str))
print("wrote B_g70_core.json")
print(json.dumps({k: res[k] for k in ["counts","unclassified","id_country_unique","id_source_unique","id_engine_unique"]}, indent=1, default=str))
print("top10 level2:", json.dumps(tab[:10], default=str))
