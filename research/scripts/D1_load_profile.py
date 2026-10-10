"""D1: Load the three feedback workbooks, profile rows/IDs/nulls/categoricals.

Writes research/data/D1_profile.json and pickles the combined tidy frame to
research/data/D_rows.pkl for downstream D_* scripts.
"""
import json
import pickle
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]  # project root
DATA = ROOT / "BMW-Data"
OUT = ROOT / "research" / "data"
OUT.mkdir(parents=True, exist_ok=True)

FILES = {"G60": "G60_feedback_hackathon.xlsx",
         "G70": "G70_feedback_hackathon.xlsx",
         "F70": "F70_feedback_hackathon.xlsx"}
SHEET = "Feedback_Explorer"
CAT_COLS = ["Source", "Brand", "Country", "Derivate (e-code)", "Engine Type",
            "Feedback Type", "Vfc level2 3 Name", "Vfc level2 Name", "Vfc level3 Name"]

frames = {}
for model, fname in FILES.items():
    df = pd.read_excel(DATA / fname, sheet_name=SHEET, dtype=object)
    df["Model"] = model
    df["Row"] = df.index + 2  # excel row number (header on row 1)
    frames[model] = df

report = {"schema_columns_seen": {m: list(frames[m].columns[:-2]) for m in frames}}

for model, df in frames.items():
    prof = {}
    prof["rows"] = int(len(df))
    prof["columns"] = [c for c in df.columns if c not in ("Model", "Row")]
    prof["null_rate_by_col"] = {c: round(float(df[c].isna().mean()), 4) for c in df.columns
                                 if c not in ("Model", "Row")}
    prof["null_count_by_col"] = {c: int(df[c].isna().sum()) for c in prof["columns"]}
    for c in ["ID", "Customer Feedback"]:
        s = df[c].dropna()
        prof[f"unique_{c.replace(' ', '')}"] = int(s.nunique())
    prof["id_row_multiplicity"] = df.groupby("ID").size().value_counts().sort_index().to_dict()
    prof["id_row_multiplicity"] = {str(k): int(v) for k, v in prof["id_row_multiplicity"].items()}
    for c in [c for c in CAT_COLS if c in df.columns]:
        vc = df[c].fillna("<NULL>").astype(str).value_counts()
        prof[f"distinct_{c}"] = {"n_distinct": int(df[c].nunique(dropna=True)),
                                  "values": {str(k): int(v) for k, v in vc.items()}}
    report[model] = prof

with open(OUT / "D1_profile.json", "w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)

df_all = pd.concat(frames.values(), ignore_index=True)
with open(OUT / "D_rows.pkl", "wb") as f:
    pickle.dump(df_all, f)

print("columns per file:", {m: report["schema_columns_seen"][m] for m in FILES})
for m in FILES:
    p = report[m]
    print(m, "rows:", p["rows"], "unique IDs:", p["unique_ID"], "unique texts:", p["unique_CustomerFeedback"])
    print("   nulls:", p["null_count_by_col"])
