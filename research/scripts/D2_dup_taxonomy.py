"""D2: Duplication model + Vfc level2 3 consistency + taxonomy comparability."""
import json
import pickle
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pickle.load(open(OUT / "D_rows.pkl", "rb"))

def norm(s):
    if not isinstance(s, str):
        return ""
    s = s.lower().replace("\u2019", "'").replace("\u2018", "'")
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

df["norm"] = df["Customer Feedback"].map(norm)
report = {}

# --- 2. Duplication model -------------------------------------------------
dup = {}
for model, g in df.groupby("Model"):
    m = {}
    m["rows"] = int(len(g))
    m["unique_IDs"] = int(g["ID"].nunique())
    m["unique_norm_texts"] = int(g["norm"].nunique())
    # multiplicity of IDs
    mult = g.groupby("ID").size()
    m["id_multiplicity_hist"] = {str(k): int(v) for k, v in mult.value_counts().sort_index().items()}
    # For multi-row IDs: do they share identical text? Do they differ in level2?
    multi_ids = mult[mult > 1].index
    same_text = 0
    diff_level2 = 0
    diff_level3 = 0
    examples_same_text = []
    examples_diff_text = []
    for i in multi_ids:
        sub = g[g["ID"] == i]
        n_texts = sub["norm"].nunique()
        l2 = sub["Vfc level2 Name"].fillna("<NULL>")
        l3 = sub["Vfc level3 Name"].fillna("<NULL>")
        if n_texts == 1:
            same_text += 1
            if len(examples_same_text) < 3 and l2.nunique() > 1:
                examples_same_text.append({
                    "ID": str(i), "texts_same": True,
                    "levels": [[str(a), str(b)] for a, b in zip(sub["Vfc level2 Name"], sub["Vfc level3 Name"])],
                    "text_head": sub["Customer Feedback"].iloc[0][:120]})
        else:
            if len(examples_diff_text) < 3:
                examples_diff_text.append({
                    "ID": str(i), "n_rows": int(len(sub)),
                    "texts": [t[:90] for t in sub["Customer Feedback"]],
                    "levels": [[str(a), str(b)] for a, b in zip(sub["Vfc level2 Name"], sub["Vfc level3 Name"])]})
        if l2.nunique() > 1:
            diff_level2 += 1
        if l3.nunique() > 1:
            diff_level3 += 1
    m["multi_row_IDs"] = int(len(multi_ids))
    m["multi_row_IDs_same_text"] = same_text
    m["multi_row_IDs_with_multiple_level2"] = diff_level2
    m["multi_row_IDs_with_multiple_level3"] = diff_level3
    m["examples_multi_same_text"] = examples_same_text
    m["examples_multi_diff_text"] = examples_diff_text
    # exact duplicate norm texts across DIFFERENT IDs
    by_text = g.groupby("norm")["ID"].nunique()
    cross = by_text[by_text > 1]
    m["norm_texts_shared_by_multiple_IDs"] = int(len(cross))
    m["rows_involved_in_cross_id_text_dupes"] = int(
        g[g["norm"].isin(cross.index)].shape[0])
    top = cross.sort_values(ascending=False).head(5)
    m["top_cross_id_dupes"] = [
        {"n_IDs": int(v), "ID_sample": sorted(str(x) for x in g[g["norm"] == k]["ID"].unique())[:6],
         "text": k[:140]} for k, v in top.items()]
    # near-dupes: prefix shingles (first 8 normalized words)
    def shingle(t):
        w = t.split()
        return " ".join(w[:8]) if len(w) >= 8 else t
    g2 = g.drop_duplicates("ID")  # one row per unique comment
    g2 = g2.assign(sh=g2["norm"].map(shingle))
    sh_counts = g2.groupby("sh")["ID"].nunique()
    near = sh_counts[sh_counts > 1]
    m["near_dupe_prefix8_clusters_within_file"] = int(len(near))
    m["near_dupe_comments_involved"] = int(near.sum())
    m["near_dupe_examples"] = [
        {"prefix": k, "IDs": sorted(str(x) for x in g2[g2["sh"] == k]["ID"])[:5]}
        for k in near.sort_values(ascending=False).head(5).index]
    dup[model] = m
report["duplication"] = dup

# cross-file exact text duplicates (norm), unique comments per model
per_model_norm = {m: set(g.drop_duplicates("ID")["norm"]) for m, g in df.groupby("Model")}
xf = {}
models = sorted(per_model_norm)
for i in range(len(models)):
    for j in range(i + 1, len(models)):
        a, b = models[i], models[j]
        inter = per_model_norm[a] & per_model_norm[b]
        xf[f"{a}&{b}"] = {"shared_norm_comments": int(len(inter)),
                          "examples_IDs": {a: [], b: []}}
        for t in list(inter)[:5]:
            xf[f"{a}&{b}"]["examples_IDs"][a] = \
                sorted(str(x) for x in df[(df.Model == a) & (df.norm == t)]["ID"].unique())[:3]
            xf[f"{a}&{b}"]["examples_IDs"][b] = \
                sorted(str(x) for x in df[(df.Model == b) & (df.norm == t)]["ID"].unique())[:3]
            xf[f"{a}&{b}"].setdefault("text_samples", []).append(t[:120])
report["cross_file_exact_text_dupes"] = xf

# --- 3. Vfc level2 3 Name consistency ---------------------------------------
vfc = {}
for model, g in df.groupby("Model"):
    gg = g.dropna(subset=["Vfc level2 3 Name", "Vfc level2 Name", "Vfc level3 Name"])
    expect = gg["Vfc level2 Name"].astype(str) + " : " + gg["Vfc level3 Name"].astype(str)
    ok = (gg["Vfc level2 3 Name"].astype(str).str.strip() == expect.str.strip())
    bad = gg[~ok]
    vfc[model] = {"rows_checked": int(len(gg)), "violations": int((~ok).sum()),
                  "examples": [{"ID": str(r["ID"]), "combined": str(r["Vfc level2 3 Name"]),
                                 "l2": str(r["Vfc level2 Name"]), "l3": str(r["Vfc level3 Name"])}
                                for _, r in bad.head(5).iterrows()]}
    # also: null pattern — level2 3 null iff level2 null?
    n23 = g["Vfc level2 3 Name"].isna()
    n2 = g["Vfc level2 Name"].isna()
    vfc[model]["level2_3_null"] = int(n23.sum())
    vfc[model]["level2_null"] = int(n2.sum())
    vfc[model]["null_mismatch"] = int((n23 != n2).sum())
report["vfc_consistency"] = vfc

# --- 4. Taxonomy comparability ----------------------------------------------
tax = {}
lvl2_by_model = {m: set(g["Vfc level2 Name"].dropna().astype(str)) for m, g in df.groupby("Model")}
lvl3_by_model = {m: set(g["Vfc level3 Name"].dropna().astype(str)) for m, g in df.groupby("Model")}
tax["level2_by_model"] = {m: sorted(v) for m, v in lvl2_by_model.items()}
all2 = set().union(*lvl2_by_model.values())
tax["level2_union_n"] = len(all2)
common2 = set.intersection(*lvl2_by_model.values())
tax["level2_common_all3"] = sorted(common2)
tax["level2_jaccard"] = {}
ms = sorted(lvl2_by_model)
for i in range(len(ms)):
    for j in range(i + 1, len(ms)):
        a, b = ms[i], ms[j]
        tax["level2_jaccard"][f"{a}&{b}"] = round(
            len(lvl2_by_model[a] & lvl2_by_model[b]) / len(lvl2_by_model[a] | lvl2_by_model[b]), 3)
tax["level2_specific_to_one_model"] = {m: sorted(lvl2_by_model[m] - set.union(*[lvl2_by_model[x] for x in ms if x != m])) for m in ms}
# level3 like/dislike prefixes + Feedback Type relation
ft = {}
for model, g in df.groupby("Model"):
    ft[model] = {"Feedback Type": {str(k): int(v) for k, v in g["Feedback Type"].fillna("<NULL>").value_counts().items()}}
    g3 = g.dropna(subset=["Vfc level3 Name"])
    l3 = g3["Vfc level3 Name"].astype(str)
    like = l3.str.startswith("Like:")
    dislike = l3.str.startswith("Dislike:")
    ftv = g3["Feedback Type"].astype(str)
    pos = ftv.str.contains("Positive", case=False, na=False)
    neg = ftv.str.contains("Negative", case=False, na=False)
    ft[model]["level3_rows"] = int(len(g3))
    ft[model]["level3_Like_prefix"] = int(like.sum())
    ft[model]["level3_Dislike_prefix"] = int(dislike.sum())
    ft[model]["level3_other_prefix"] = int((~(like | dislike)).sum())
    ft[model]["contradictions_Like_not_Positive"] = int((like & ~pos).sum())
    ft[model]["contradictions_Dislike_not_Negative"] = int((dislike & ~neg).sum())
    ft[model]["like_rows_FeedbackType_values"] = {str(k): int(v) for k, v in g3[like]["Feedback Type"].fillna("<NULL>").value_counts().items()}
    ft[model]["dislike_rows_FeedbackType_values"] = {str(k): int(v) for k, v in g3[dislike]["Feedback Type"].fillna("<NULL>").value_counts().items()}
    # sample of contradiction rows
    con = g3[(like & ~pos) | (dislike & ~neg)]
    ft[model]["contradiction_examples"] = [{"ID": str(r["ID"]), "FT": str(r["Feedback Type"]), "L3": str(r["Vfc level3 Name"])} for _, r in con.head(5).iterrows()]
report["taxonomy"] = {"level2": tax, "feedback_type": ft}
# full level3 distinct counts
report["taxonomy"]["level3_distinct_counts"] = {m: int(g["Vfc level3 Name"].nunique()) for m, g in df.groupby("Model")}
lv3_common = set.intersection(*lvl3_by_model.values())
report["taxonomy"]["level3_common_all3_n"] = len(lv3_common)
all3 = set().union(*lvl3_by_model.values())
report["taxonomy"]["level3_union_n"] = len(all3)

with open(OUT / "D2_dup_taxonomy.json", "w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)
df[["Model", "Row", "ID", "norm"]].to_pickle(OUT / "D_norm.pkl")
print(json.dumps({m: {k: dup[m][k] for k in ["rows", "unique_IDs", "unique_norm_texts", "multi_row_IDs", "multi_row_IDs_same_text", "multi_row_IDs_with_multiple_level2", "norm_texts_shared_by_multiple_IDs", "near_dupe_prefix8_clusters_within_file"]} for m in dup}, indent=1))
print("vfc:", json.dumps(vfc, indent=1)[:600])
print("xf:", json.dumps({k: v["shared_norm_comments"] for k, v in xf.items()}))
