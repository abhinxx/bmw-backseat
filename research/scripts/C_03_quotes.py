"""C_03: For top-10 dislike level2 categories, 2 verbatim quotes each with record ID
(texts with >=60 chars, prefer distinct texts), truncated to 200 chars."""
import json
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_pickle(f"{ROOT}/research/data/C_f70.pkl")
df["_text_norm"] = df["Customer Feedback"].astype(str).str.strip().str.lower()
ft = df["Feedback Type"].astype(str)
df["_is_like"] = ft == "Likes"
df["_is_neg"] = ft.isin({"Defect", "Difficult to Use", "Wants"})
p2 = json.load(open(f"{ROOT}/research/data/C_f70_part2.json"))
L2 = "Vfc level2 Name"
top10 = [t["theme"] for t in p2["top15_dislike_themes_overall"][:10]]

def trunc(s, n=200):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[:197] + "..."

quotes = {}
for cat in top10:
    g = df[(df[L2] == cat) & df["_is_neg"]].drop_duplicates("ID")
    g = g[g["_text_norm"].str.len() >= 60].sort_values("_text_norm", key=lambda s: -s.str.len())
    picked, seen = [], set()
    for _, r in g.iterrows():
        if r["_text_norm"] in seen: continue
        picked.append({"ID": r["ID"], "Country": r["Country"],
                       "feedback_type": str(r["Feedback Type"]),
                       "level3": str(r["Vfc level3 Name"]),
                       "quote": trunc(r["Customer Feedback"])})
        seen.add(r["_text_norm"])
        if len(picked) >= 2: break
    quotes[cat] = picked

with open(f"{ROOT}/research/data/C_f70_quotes.json", "w") as f:
    json.dump(quotes, f, indent=1, ensure_ascii=False)
print(json.dumps(quotes, indent=1, ensure_ascii=False)[:3000])
