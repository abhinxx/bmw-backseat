"""C_07: Merge all C_ part JSONs into C_f70_aggregates.json."""
import json
ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
R = f"{ROOT}/research/data"
parts = {"part1_profile": "C_f70_part1.json", "part2_taxonomy": "C_f70_part2.json",
         "quotes": "C_f70_quotes.json", "features": "C_f70_features.json",
         "features_by_country_split": "C_f70_features_byc.json",
         "segments": "C_f70_segments.json", "quality": "C_f70_quality.json"}
agg = {"model": "F70 (BMW 1 Series)", "source_workbook": "BMW-Data/F70_feedback_hackathon.xlsx",
       "sheet": "Feedback_Explorer", "scripts": "research/scripts/C_01..C_07",
       "dislike_definition": "Feedback Type in {Defect, Difficult to Use, Wants}",
       "like_definition": "Feedback Type == 'Likes'"}
for k, fn in parts.items():
    agg[k] = json.load(open(f"{R}/{fn}"))
with open(f"{R}/C_f70_aggregates.json", "w") as f:
    json.dump(agg, f, indent=1, ensure_ascii=False)
print("merged keys:", list(agg.keys()))
import os
print("size:", os.path.getsize(f"{R}/C_f70_aggregates.json"))
