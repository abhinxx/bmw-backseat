"""C_01: Load F70 feedback workbook, cache pickle, produce counts/duplications/
distributions/cross-tabs. Writes research/data/C_f70_part1.json. All counts by script."""
import json, pickle
from collections import Counter
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_excel(f"{ROOT}/BMW-Data/F70_feedback_hackathon.xlsx", sheet_name="Feedback_Explorer")
df.to_pickle(f"{ROOT}/research/data/C_f70.pkl")  # cache for later scripts

out = {}

# --- 1. Row vs unique ID vs unique comment text ---
df["_text_norm"] = df["Customer Feedback"].astype(str).str.strip().str.lower()
out["rows"] = int(len(df))
out["unique_ids"] = int(df["ID"].nunique())
out["unique_comment_texts"] = int(df["_text_norm"].nunique())
out["rows_per_id_mean"] = round(len(df) / df["ID"].nunique(), 3)

# duplication mechanism: distribution of rows per ID
rpi = df.groupby("ID").size()
out["rows_per_id_distribution"] = {str(k): int(v) for k, v in sorted(Counter(rpi).items())}

# 2 concrete examples: IDs with >1 rows where rows differ in taxonomy labels
ex = []
for _id, g in df.groupby("ID"):
    if len(g) > 1:
        labs = g[["Feedback Type", "Vfc level2 Name", "Vfc level3 Name"]].astype(str).values.tolist()
        if len(set(map(str, labs))) > 1:
            ex.append({"ID": _id, "rows": len(g), "identical_text": g["_text_norm"].nunique() == 1,
                       "labels": labs})
    if len(ex) >= 2:
        break
out["duplication_examples"] = ex

# same comment text shared across different IDs?
t2 = df.groupby("_text_norm")["ID"].nunique()
out["texts_shared_by_multiple_ids"] = int((t2 > 1).sum())

# --- 2. Distributions (rows and unique IDs) ---
def dist(col):
    rows = Counter(df[col].astype(str))
    u = df.drop_duplicates("ID")[col].astype(str)
    uniq = Counter(u)
    return {"rows": dict(rows.most_common()), "unique_ids": dict(uniq.most_common())}

out["dist_source"] = dist("Source")
out["dist_country"] = dist("Country")
out["dist_engine"] = dist("Engine Type")
out["dist_feedback_type"] = dist("Feedback Type")
out["dist_brand"] = dist("Brand")
out["dist_sales_desc"] = dist("Sales Description")

# cross-tabs on unique IDs (one row per ID using first) and on rows
def crosstab(c1, c2, unique=True):
    d = df.drop_duplicates("ID") if unique else df
    ct = pd.crosstab(d[c1].astype(str), d[c2].astype(str))
    return ct.to_dict()

out["xtab_source_country_unique"] = crosstab("Source", "Country")
out["xtab_source_country_rows"] = crosstab("Source", "Country", unique=False)
out["xtab_country_engine_unique"] = crosstab("Country", "Engine Type")
out["xtab_country_engine_rows"] = crosstab("Country", "Engine Type", unique=False)

# Derivate values
out["dist_derivate"] = dist("Derivate (e-code)")

# language-ish: share of non-ascii / quick locale guess left to report caveats
with open(f"{ROOT}/research/data/C_f70_part1.json", "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
print("OK rows=", out["rows"], "ids=", out["unique_ids"], "texts=", out["unique_comment_texts"])
print("countries:", list(out["dist_country"]["unique_ids"].items())[:8])
print("engines:", list(out["dist_engine"]["unique_ids"].items()))
print("feedback:", list(out["dist_feedback_type"]["unique_ids"].items()))
print("sources:", list(out["dist_source"]["unique_ids"].items()))
