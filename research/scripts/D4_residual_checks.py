"""D4: residual checks — ID contiguity, where nulls concentrate (Source x
level2-null x FT-null), level3 prefix grammar, per-ID attribute consistency."""
import json
import pickle
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pickle.load(open(OUT / "D_rows.pkl", "rb"))
rep = {}

# ID contiguity: ID = MODEL-NNNN; check the numeric set is contiguous 1..max
ids = {}
for model, g in df.groupby("Model"):
    nums = sorted(int(str(i).split("-")[1]) for i in g["ID"].unique())
    ids[model] = {"min": nums[0], "max": nums[-1], "n_unique": len(nums),
                  "contiguous_1_to_max": nums == list(range(1, len(nums) + 1)),
                  "gaps": [k for k in range(nums[0], nums[-1] + 1) if k not in set(nums)][:10]}
rep["id_contiguity"] = ids

# where do nulls concentrate
rows = {}
for model, g in df.groupby("Model"):
    rows[model] = {
        "FT_null_by_source": {str(k): int(v) for k, v in g[g["Feedback Type"].isna()]["Source"].value_counts().items()},
        "level2_null_by_source": {str(k): int(v) for k, v in g[g["Vfc level2 Name"].isna()]["Source"].value_counts().items()},
        "level3_null_by_source": {str(k): int(v) for k, v in g[g["Vfc level3 Name"].isna()]["Source"].value_counts().items()},
        "FT_null_and_level2_null": int((g["Feedback Type"].isna() & g["Vfc level2 Name"].isna()).sum()),
        "sourceD_FT_nonnull": int((g[(g["Source"] == "Source D")]["Feedback Type"].notna()).sum()),
    }
rep["null_patterns"] = rows

# level3 prefix grammar
pref = {}
for model, g in df.groupby("Model"):
    l3 = g["Vfc level3 Name"].dropna().astype(str)
    p = l3.map(lambda s: s.split(":")[0] + ":" if ":" in s else "<no-colon>")
    pref[model] = {str(k): int(v) for k, v in p.value_counts().items()}
rep["level3_prefix_grammar"] = pref

# per-ID consistency of structural attributes
cons = {}
for model, g in df.groupby("Model"):
    gb = g.groupby("ID")
    cons[model] = {
        "IDs_varying_Country": int((gb["Country"].nunique() > 1).sum()),
        "IDs_varying_Source": int((gb["Source"].nunique() > 1).sum()),
        "IDs_varying_EngineType": int((gb["Engine Type"].nunique() > 1).sum()),
    }
rep["per_id_attribute_consistency"] = cons

# no_class_found / unlabelled level2 values
rep["no_class_level2_counts"] = {
    m: int(g["Vfc level2 Name"].astype(str).str.contains("no_class_found", na=False).sum())
    for m, g in df.groupby("Model")}

# does every unique ID map to exactly 1 Source/Country? (dedupe sanity)
com = df.drop_duplicates(["Model", "ID"])
rep["unique_comments_dedup_rule"] = "first row per (Model, ID)"
rep["comments_per_model"] = {m: int(len(g)) for m, g in com.groupby("Model")}

with open(OUT / "D4_residual.json", "w") as f:
    json.dump(rep, f, indent=1, ensure_ascii=False)
print(json.dumps(rep, indent=1)[:3000])
