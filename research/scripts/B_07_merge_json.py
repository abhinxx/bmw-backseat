"""B_07: Merge core/themes/features/diag JSONs into research/data/B_g70_aggregates.json."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
agg = {"provenance": {
    "workbook": "BMW-Data/G70_feedback_hackathon.xlsx",
    "sheet": "Feedback_Explorer",
    "scripts": ["B_01_load_explore.py", "B_02_core_aggregates.py", "B_03_themes_quotes.py",
                "B_04_features_segments.py", "B_05_diagnostics.py", "B_06_fixups.py"],
    "sentiment_note": "No literal 'Dislikes' Feedback Type exists. 'Negative' = {Difficult to Use, Defect}. 'Wants' and (None) kept separate.",
    "counting": "unique_ids = distinct IDs with >=1 matching row; rows also reported where relevant."}}
for name in ["core", "themes", "features", "features2", "diag"]:
    agg[name] = json.loads((OUT / f"B_g70_{name}.json").read_text())
(OUT / "B_g70_aggregates.json").write_text(json.dumps(agg, indent=1, ensure_ascii=False))
print("wrote B_g70_aggregates.json", (OUT / "B_g70_aggregates.json").stat().st_size, "bytes")
