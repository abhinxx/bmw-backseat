"""B_03: Theme tables (negative & positive), country split, quotes for top dislike categories.

Run from project root. Writes research/data/B_g70_themes.json.

Negative sentiment = Feedback Type in {Dislikes, Difficult to Use, Defect}
  (no literal 'Dislikes' rows exist; the dislike-like signals are these three — verified in B_02).
Positive sentiment = Feedback Type == 'Likes'.
Wants and (None) reported separately, not merged into either.
Counts = unique IDs per level2 category (dedup: one ID counted once per category).
"""
import pandas as pd, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pd.read_pickle(OUT / "B_g70.pkl")
df["level2"] = df["Vfc level2 Name"].fillna("(missing)").astype(str)

NEG = ["Dislikes", "Difficult to Use", "Defect"]
neg = df[df["Feedback Type"].isin(NEG)].copy()
neg["neg_kind"] = df.loc[neg.index, "Feedback Type"]
pos = df[df["Feedback Type"] == "Likes"].copy()
wants = df[df["Feedback Type"] == "Wants"].copy()

res = {}
res["feedback_type_unique_ids"] = {str(k): int(v) for k, v in df.groupby(df["Feedback Type"].fillna("(None)"))["ID"].nunique().items()}

def theme_table(sub, label):
    g = sub.groupby("level2")["ID"].nunique().sort_values(ascending=False)
    rows = []
    for cat, n in g.head(15).items():
        s = sub[sub.level2 == cat]
        kinds = {k: int(s[s.neg_kind == k]["ID"].nunique()) for k in NEG} if label == "neg" else {}
        row = {"theme": cat, "unique_ids": int(n)}
        row.update(kinds)
        rows.append(row)
    return rows
res["top15_negative_themes_overall"] = theme_table(neg, "neg")
res["top15_positive_themes_overall"] = theme_table(pos, "pos")
res["top10_wants_themes_overall"] = theme_table(wants, "w")

# country split: US vs KR (next largest by unique IDs) — per-theme uid counts
def by_country(sub, country, k=15):
    s = sub[sub.Country == country]
    g = s.groupby("level2")["ID"].nunique().sort_values(ascending=False)
    return [{"theme": c, "unique_ids": int(n)} for c, n in g.head(k).items()], int(s["ID"].nunique())
res["country_totals"] = {}
for c in ["US", "KR", "JP"]:
    res["country_totals"][c] = {"ids": int(df[df.Country == c]["ID"].nunique())}
res["US_neg_themes"] = by_country(neg, "US")[0]
res["KR_neg_themes"] = by_country(neg, "KR")[0]
res["US_pos_themes"] = by_country(pos, "US")[0]
res["JP_pos_themes"] = by_country(pos, "JP")[0]
res["KR_pos_themes"] = by_country(pos, "KR")[0]

# KR rows with any US-comparable signal? KR n per theme for the n>=30 check
krg = neg[neg.Country == "KR"].groupby("level2")["ID"].nunique()
res["KR_neg_theme_max"] = int(krg.max()) if len(krg) else 0
jpg = pos[pos.Country == "JP"].groupby("level2")["ID"].nunique()
res["JP_pos_theme_max"] = int(jpg.max()) if len(jpg) else 0

# quotes for top-10 negative categories: 2 verbatim each, prefer shortest informative, with record IDs
top10 = [r["theme"] for r in res["top15_negative_themes_overall"][:10]]
res["quotes_neg"] = {}
for cat in top10:
    s = neg[neg.level2 == cat].copy()
    s["L"] = s["Customer Feedback"].astype(str).str.len()
    s = s.sort_values("L")
    seen, picks = set(), []
    for _, r in s.iterrows():
        if r["ID"] in seen: continue
        seen.add(r["ID"]); picks.append(r)
        if len(picks) == 2: break
    res["quotes_neg"][cat] = [{
        "ID": r["ID"], "Country": r["Country"], "Engine": r["Engine Type"],
        "FeedbackType": r["Feedback Type"], "level3": str(r["Vfc level3 Name"]),
        "text": str(r["Customer Feedback"]),
        "chars": int(r["L"])
    } for r in picks]

(OUT / "B_g70_themes.json").write_text(json.dumps(res, indent=1, ensure_ascii=False, default=str))
print("wrote B_g70_themes.json")
print("neg15:", json.dumps(res["top15_negative_themes_overall"], default=str))
print("pos15:", json.dumps(res["top15_positive_themes_overall"], default=str))
print("KR neg max theme n:", res["KR_neg_theme_max"], "| JP pos max:", res["JP_pos_theme_max"])
