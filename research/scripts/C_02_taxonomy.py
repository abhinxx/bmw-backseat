"""C_02: Per-ID field consistency, correct feedback-type counting (a customer can
have several feedback types), taxonomy distributions, unclassified rate,
theme tops overall + per big country, quotes. Writes C_f70_part2.json."""
import json
from collections import Counter
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_pickle(f"{ROOT}/research/data/C_f70.pkl")
out = {}

# --- per-ID consistency of stable fields ---
def consistent(col):
    g = df.groupby("ID")[col].nunique(dropna=False)
    return {"max_per_id": int(g.max()), "ids_inconsistent": int((g > 1).sum())}
for c in ["Country", "Source", "Engine Type", "Derivate (e-code)", "Sales Description"]:
    out[f"consistency_{c}"] = consistent(c)

# Country per ID (should be unique)
cid = df.drop_duplicates("ID")[["ID", "Country"]]
out["country_unique_ids"] = dict(Counter(cid["Country"]).most_common())

# --- Feedback type: two views ---
# (a) rows: each (ID, Feedback Type) pair counted once
pairs = df.drop_duplicates(["ID", "Feedback Type"])
out["feedback_type_unique_id_pairs"] = dict(Counter(pairs["Feedback Type"].astype(str)).most_common())
# (b) IDs by whether they carry any Likes / any negative (Defect/Difficult/Wants) / only nan-classified
ft = df["Feedback Type"].astype(str)
neg_types = {"Defect", "Difficult to Use", "Wants"}
df["_is_like"] = ft == "Likes"
df["_is_neg"] = ft.isin(neg_types)
byid = df.groupby("ID").agg(any_like=("_is_like", "any"), any_neg=("_is_neg", "any"))
seg = Counter()
for _, r in byid.iterrows():
    if r.any_like and r.any_neg: seg["both_like_and_negative"] += 1
    elif r.any_like: seg["likes_only"] += 1
    elif r.any_neg: seg["negative_only"] += 1
    else: seg["no_class_found_only"] += 1
out["id_sentiment_mix"] = dict(seg)
out["total_unique_ids"] = int(len(byid))

# --- Taxonomy: top 25 level2 by unique-ID count with Likes vs Dislikes split ---
# "Dislikes" = any negative Feedback Type (Defect/Difficult to Use/Wants); Likes = 'Likes'
L2 = "Vfc level2 Name"
rows = []
for lab, g in df[df[L2].notna()].groupby(L2):
    ids = g["ID"].nunique()
    likes = g[g["_is_like"]]["ID"].nunique()
    neg = g[g["_is_neg"]]["ID"].nunique()
    rows.append({"level2": lab, "unique_ids": int(ids), "unique_ids_likes": int(likes),
                 "unique_ids_negative": int(neg)})
rows.sort(key=lambda r: -r["unique_ids"])
out["top25_level2"] = rows[:25]
out["level2_count_total"] = len(rows)

# unclassified rate
uncl_ids_rows = df[(df[L2].astype(str) == "no_class_found") | df[L2].isna()]
ids_no_class_rows = set(uncl_ids_rows["ID"])
# IDs where ALL rows are no_class_found
per_id_all_unclass = df.groupby("ID").apply(lambda g: set(g[L2].astype(str)) <= {"no_class_found", "None", "nan"}, include_groups=False)
out["unclassified"] = {
    "rows_no_class_found": int(len(uncl_ids_rows)),
    "ids_with_any_no_class_row": int(len(ids_no_class_rows)),
    "ids_where_every_row_unclassified": int(per_id_all_unclass.sum()),
    "pct_of_unique_ids_any_unclassified": round(100 * len(ids_no_class_rows) / len(byid), 1),
    "pct_ids_fully_unclassified": round(100 * int(per_id_all_unclass.sum()) / len(byid), 1),
}

# --- Theme tops: level2 x sentiment. "dislike themes" = level2 labels carrying
# negative types; "like themes" = level2 carrying Likes. Ranked by unique IDs. ---
def theme_table(mask, n=15):
    d = df[mask & df[L2].notna() & (df[L2].astype(str) != "no_class_found")]
    res = []
    for lab, g in d.groupby(L2):
        res.append({"theme": lab, "unique_ids": int(g["ID"].nunique())})
    res.sort(key=lambda r: -r["unique_ids"])
    return res[:n]
out["top15_dislike_themes_overall"] = theme_table(df["_is_neg"])
out["top15_like_themes_overall"] = theme_table(df["_is_like"])

# per country (GB, JP are the two largest; include all with >=30 unique-ID comments)
big = [c for c, n in out["country_unique_ids"].items() if n >= 30]
out["countries_ge30"] = big
out["themes_by_country"] = {}
for c in big:
    dc = df[df["Country"] == c]
    n_id = dc["ID"].nunique()
    out["themes_by_country"][c] = {
        "unique_ids": int(n_id),
        "top15_dislikes": theme_table(dc["_is_neg"]),
        "top15_likes": theme_table(dc["_is_like"]),
    }

with open(f"{ROOT}/research/data/C_f70_part2.json", "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
print("OK. countries>=30:", big)
print("sentiment mix:", out["id_sentiment_mix"])
print("unclassified:", out["unclassified"])
print("top5 dislikes:", [ (t['theme'],t['unique_ids']) for t in out["top15_dislike_themes_overall"][:5]])
print("top5 likes:", [ (t['theme'],t['unique_ids']) for t in out["top15_like_themes_overall"][:5]])
