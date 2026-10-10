"""B_01: Load G70 workbook, dump to pickle + basic structure info.

Run from project root:
  .venv/bin/python research/scripts/B_01_load_explore.py
Writes: research/data/B_g70.pkl (full df), prints structure facts.
"""
import pandas as pd, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
XLSX = ROOT / "BMW-Data" / "G70_feedback_hackathon.xlsx"
OUT = ROOT / "research" / "data"
OUT.mkdir(parents=True, exist_ok=True)

xl = pd.ExcelFile(XLSX)
print("sheets:", xl.sheet_names)
df = xl.parse("Feedback_Explorer", dtype=object)
print("rows:", len(df))
print("cols:", list(df.columns))
for c in df.columns:
    nn = df[c].notna().sum()
    nu = df[c].nunique(dropna=True)
    print(f"  {c!r}: non-null={nn} unique={nu}")
# head sample
with pd.option_context("display.max_colwidth", 60):
    print(df.head(3).to_string())
df.to_pickle(OUT / "B_g70.pkl")
print("saved pickle")
