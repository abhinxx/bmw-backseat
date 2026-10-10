#!/usr/bin/env python
"""A_aggregate.py — all aggregates for the G60 feedback report. Writes research/data/A_g60_aggregates.json.
Every number in report A comes from this script's output. Rows = spreadsheet rows; IDs = unique comments."""
import json, re, math
import pandas as pd

df = pd.read_csv("research/data/A_g60_feedback_explorer.csv", dtype=str)
df["Customer Feedback"] = df["Customer Feedback"].fillna("")
R = {}  # results container

# ---------- 1. counts & duplication ----------
def dist_rows_ids(series_name):
    s = df[series_name].fillna("(missing)")
    rows = s.value_counts().to_dict()
    ids = df.assign(k=s).groupby("k")["ID"].nunique().sort_values(ascending=False).to_dict()
    return {str(k): {"rows": int(rows.get(k, 0)), "unique_ids": int(ids.get(k, 0))} for k in set(rows) | set(ids)}

id_stats = df.groupby("ID").agg(n_rows=("Source", "size"),
                               n_texts=("Customer Feedback", "nunique"),
                               n_sources=("Source", "nunique"),
                               n_countries=("Country", "nunique"),
                               n_engines=("Engine Type", "nunique"),
                               n_ftypes=("Feedback Type", "nunique"),
                               n_l2=("Vfc level2 Name", "nunique"))
R["counts"] = {
    "rows": int(len(df)),
    "unique_ids": int(df["ID"].nunique()),
    "unique_feedback_texts": int(df["Customer Feedback"].nunique()),
    "rows_per_id": {str(k): int(v) for k, v in id_stats["n_rows"].value_counts().sort_index().items()},
    "ids_with_multiple_texts": int((id_stats["n_texts"] > 1).sum()),
    "ids_with_multiple_sources": int((id_stats["n_sources"] > 1).sum()),
    "ids_with_multiple_countries": int((id_stats["n_countries"] > 1).sum()),
    "ids_with_multiple_engines": int((id_stats["n_engines"] > 1).sum()),
    "max_categories_per_id": int(id_stats["n_l2"].max()),
    "text_duplicated_across_ids": int(len(df.drop_duplicates("Customer Feedback").groupby("Customer Feedback").filter(lambda g: g["ID"].nunique() > 1))),
}

# duplication examples: two IDs with many rows, show row detail
ex_ids = id_stats.sort_values("n_rows", ascending=False)["n_rows"].head(2).index.tolist()
R["duplication_examples"] = []
for i in ex_ids:
    sub = df[df["ID"] == i]
    R["duplication_examples"].append({
        "id": i, "rows": int(len(sub)),
        "country": sub["Country"].iloc[0], "engine": sub["Engine Type"].iloc[0],
        "feedback_types": sorted(sub["Feedback Type"].fillna("(missing)").unique().tolist()),
        "categories": sorted(sub["Vfc level2 3 Name"].fillna("(missing)").unique().tolist()),
        "text_head": sub["Customer Feedback"].iloc[0][:300],
    })

# ---------- 2. distributions ----------
R["distributions"] = {
    "Source": dist_rows_ids("Source"),
    "Country": dist_rows_ids("Country"),
    "Engine Type": dist_rows_ids("Engine Type"),
    "Feedback Type": dist_rows_ids("Feedback Type"),
}
xt_sc_rows = pd.crosstab(df["Source"], df["Country"])
xt_sc_ids = df.groupby(["Source", "Country"])["ID"].nunique().unstack(fill_value=0)
xt_ce_rows = pd.crosstab(df["Country"], df["Engine Type"])
xt_ce_ids = df.groupby(["Country", "Engine Type"])["ID"].nunique().unstack(fill_value=0)
def crosstab_json(rows, ids):
    out = {}
    for r in rows.index:
        out[str(r)] = {str(c): {"rows": int(rows.loc[r, c]),
                                "unique_ids": int(ids.loc[r, c]) if (r in ids.index and c in ids.columns) else 0} for c in rows.columns}
    return out
R["crosstabs"] = {"source_x_country": crosstab_json(xt_sc_rows, xt_sc_ids),
                  "country_x_engine": crosstab_json(xt_ce_rows, xt_ce_ids)}

# ---------- sentiment mapping ----------
FT_MAP = {"Likes": "like", "Difficult to Use": "dislike", "Defect": "dislike", "Wants": "want"}
df["sent"] = df["Feedback Type"].map(FT_MAP).fillna("unlabeled")

# ---------- 3. taxonomy ----------
cl2 = df["Vfc level2 Name"].fillna("(missing)")
unclassified_rows = int(((cl2 == "no_class_found") | (cl2 == "(missing)")).sum())
unclassified_ids = int(df.loc[(cl2 == "no_class_found") | (cl2 == "(missing)"), "ID"].nunique())
# per-ID unclassified = IDs where EVERY row is unclassified
per_id = df.assign(c=cl2).groupby("ID")["c"].apply(lambda s: ((s == "no_class_found") | (s == "(missing)")).all())
R["taxonomy"] = {
    "unclassified_rows": unclassified_rows, "unclassified_row_pct": round(100 * unclassified_rows / len(df), 1),
    "unclassified_ids_any_row": unclassified_ids,
    "unclassified_ids_all_rows": int(per_id.sum()),
    "unclassified_id_pct_all_rows": round(100 * per_id.sum() / df["ID"].nunique(), 1),
    "n_level2_values": int(df["Vfc level2 Name"].nunique()),
}
rows_l2 = []
for cat, g in df.assign(c=cl2).groupby("cl2" if False else "c"):
    if cat in ("no_class_found", "(missing)"):
        continue
    st = g["sent"].value_counts()
    rows_l2.append({"category": cat, "unique_ids": int(g["ID"].nunique()), "rows": int(len(g)),
                    "like": int(st.get("like", 0)), "dislike": int(st.get("dislike", 0)),
                    "want": int(st.get("want", 0)), "unlabeled": int(st.get("unlabeled", 0))})
R["taxonomy"]["top25_level2_by_unique_ids"] = sorted(rows_l2, key=lambda x: -x["unique_ids"])[:25]

# ---------- 4. themes (theme = level2 : level3 pair) ----------
def theme_table(sent_filter, min_ids=None, countries=None):
    d = df[df["sent"].isin(sent_filter)]
    if countries:
        d = d[d["Country"].isin(countries)]
    d = d[~d["Vfc level2 3 Name"].isna() & (d["Vfc level2 3 Name"] != "no_class_found")]
    out = []
    for th, g in d.groupby("Vfc level2 3 Name"):
        out.append({"theme": th, "unique_ids": int(g["ID"].nunique()), "rows": int(len(g))})
    out.sort(key=lambda x: -x["unique_ids"])
    return out

R["themes"] = {
    "overall_like_top15": theme_table(["like"])[:15],
    "overall_dislike_top15": theme_table(["dislike"])[:15],
    "overall_want_top15": theme_table(["want"])[:15],
}
countries = df.groupby("Country")["ID"].nunique().sort_values(ascending=False)
top_c, second_c = countries.index[0], countries.index[1]
R["country_sizes_unique_ids"] = {str(k): int(v) for k, v in countries.items()}
for c in [top_c, second_c]:
    n = countries[c]
    R["themes"][f"{c}_dislike"] = theme_table(["dislike"], countries=[c])[:15] if n >= 30 else f"insufficient (n={n} unique IDs < 30)"
    R["themes"][f"{c}_like"] = theme_table(["like"], countries=[c])[:15] if n >= 30 else f"insufficient (n={n} unique IDs < 30)"

# ---------- 5. quotes for top-10 dislike categories ----------
dis = df[(df["sent"] == "dislike") & df["Vfc level2 Name"].notna() & (df["Vfc level2 Name"] != "no_class_found")]
top10_dis_cats = dis.groupby("Vfc level2 Name")["ID"].nunique().sort_values(ascending=False).head(10)
def quote(row):
    t = row["Customer Feedback"].replace("\\n", " ").strip()
    return {"id": row["ID"], "country": row["Country"], "engine": row["Engine Type"],
            "feedback_type": row["Feedback Type"],
            "text": (t[:200] + " […truncated]") if len(t) > 200 else t}
R["dislike_quotes"] = {}
for cat in top10_dis_cats.index:
    g = dis[dis["Vfc level2 Name"] == cat]
    picked, seen = [], set()
    for _, r in g.iterrows():  # prefer distinct IDs, longest texts (more informative)
        if r["ID"] in seen:
            continue
        picked.append(quote(r)); seen.add(r["ID"])
        if len(picked) == 2:
            break
    R["dislike_quotes"][cat] = {"unique_ids": int(top10_dis_cats[cat]), "quotes": picked}

# ---------- 6. feature-level signals ----------
# taxonomy = level2 label match; keyword = regex on Customer Feedback text. Counted separately, per unique ID.
FEATS = {
    "rear_seat_comfort_heating": {"tax": r"rear seat|rear bench|Seats", "kw": r"rear seat|back seat|backseat|rear passenger|back seat comfort|rear leg ?room"},
    "seat_heating_ventilation": {"tax": r"^Seats$|Seat heating|Seat ventilation", "kw": r"seat heat|heated seat|seat heater|seat warm|seat ventilat|ventilated seat|seat cool|cooled seat|air ?condition(ed|ing) seat"},
    "exterior_colour_paint": {"tax": r"paint|colour|color|Exterior design", "kw": r"\bpaint\b|colour|color\b"},
    "performance_power": {"tax": r"performance|driving dynamics|Drivetrain|Handling", "kw": r"acceleration|horsepower|torque|0-60|pickup|power(ful)?|fast|quick(ly)? (accelerate|pass)"},
    "digital_idrive_infotainment_controls": {"tax": r"Touch screen|operat|user-friendly|infotainment|digital|app\b|software|screen", "kw": r"carplay|car play|android auto|infotainment|i ?drive|idrive|touch ?screen|menu|software|update|app\b|button|control"},
    "controls_complexity_narrow": {"tax": r"Not user-friendly", "l3": True, "kw": r"hard to (?:use|find|figure)|confus|complicated|too many (?:menus|steps)|counter.?intuitive|can'?t (?:find|remember)"},
    "driver_assistance": {"tax": r"assist|lane|cruise|parking assist|automated|assistance", "kw": r"driving assist|lane.?keep|lane.?depart|adaptive cruise|highway assist|assisted (driving|parking)|self.?park|automatic parking|hands.?off|routing|traffic jam assist"},
}
def feat_signal(name, spec):
    tax_col = df["Vfc level3 Name"] if spec.get("l3") else df["Vfc level2 Name"]
    tax_mask = tax_col.fillna("").str.contains(spec["tax"], case=False, regex=True)
    kw_mask = df["Customer Feedback"].str.contains(spec["kw"], case=False, regex=True)
    out = {}
    for label, mask in (("taxonomy", tax_mask), ("keyword", kw_mask), ("taxonomy_or_keyword", tax_mask | kw_mask)):
        d = df[mask]
        ids = d["ID"].nunique()
        st = d.groupby("ID")["sent"].apply(lambda s: "dislike" if "dislike" in set(s) else ("like" if "like" in set(s) else ("want" if "want" in set(s) else "unlabeled")))
        by_country = {str(c): int(g) for c, g in d.groupby("Country")["ID"].nunique().sort_values(ascending=False).items() if g >= 3}
        out[label] = {"unique_ids": int(ids), "rows": int(len(d)),
                      "id_sentiment": {k: int(v) for k, v in st.value_counts().items()},
                      "by_country_unique_ids": by_country}
    return out
R["features"] = {k: feat_signal(k, v) for k, v in FEATS.items()}

# ---------- 7. candidate behavioural segments (per unique ID) ----------
txt = df.assign(kw=df.groupby("ID")["Customer Feedback"].transform("first"))
T = txt.drop_duplicates("ID").set_index("ID")
sent_by_id = df.groupby("ID")["sent"].apply(set)
tax_by_id = df.groupby("ID")["Vfc level2 Name"].apply(lambda s: " ".join(s.fillna("").tolist()))
def has(pattern, source):
    return source.str.contains(pattern, case=False, regex=True, na=False)

comfort_kw = has(r"comfort|seat|quiet|noise|ride|suspension|spacious|leg ?room", T["Customer Feedback"])
comfort_pos = comfort_kw & sent_by_id.apply(lambda s: "like" in s)
comfort_neg = comfort_kw & sent_by_id.apply(lambda s: "dislike" in s)
controls_neg = (tax_by_id.str.contains("user-friendly", case=False) |
                has(r"touch ?screen|button|menu|control", T["Customer Feedback"])) & sent_by_id.apply(lambda s: "dislike" in s)
perform_enthus = has(r"acceleration|handling|drives? (great|amazing|fantastic)|fun to drive|power|sport mode|steering", T["Customer Feedback"]) & sent_by_id.apply(lambda s: "like" in s)
tech_focus = (tax_by_id.str.contains("screen|digital|app|assist|carplay|infotainment", case=False) |
              has(r"carplay|android auto|app\b|software|digital key|over.?the.?air|update", T["Customer Feedback"]))
range_concern = has(r"\brange\b|charg|kwh|battery|efficien", T["Customer Feedback"]) & sent_by_id.apply(lambda s: "dislike" in s or "want" in s)
value_cost = has(r"price|expensive|value|money|cost|worth|overpric|premium", T["Customer Feedback"])
overall_pos = sent_by_id.apply(lambda s: "like" in s and "dislike" not in s)
overall_mixed = sent_by_id.apply(lambda s: "like" in s and "dislike" in s)
n = T.shape[0]
segs = {
    "comfort_focused_positive": int((comfort_pos).sum()),
    "comfort_negatives": int((comfort_neg).sum()),
    "frustrated_by_controls_usability": int(controls_neg.sum()),
    "performance_enthusiast": int(perform_enthus.sum()),
    "tech_digital_focus": int(tech_focus.sum()),
    "ev_range_charging_concerned": int((range_concern & T["Engine Type"].isin(["BEVE", "PHEV"])).sum()),
    "value_cost_sensitive_voiced": int(value_cost.sum()),
    "pure_praisers_like_no_dislike": int(overall_pos.sum()),
    "mixed_valuers_like_and_dislike": int(overall_mixed.sum()),
    "total_unique_ids": n,
    "note": "overlapping flags, not a partition; keyword/taxonomy presence per comment, not stated priorities",
}
engine_by_id = T["Engine Type"].to_dict()
segs["frustrated_by_controls_usability_by_engine"] = {e: int(sum(1 for i in T.index[controls_neg] if engine_by_id[i] == e)) for e in sorted(set(T["Engine Type"]))}
segs["tech_digital_focus_by_country_top5"] = {str(c): int(g) for c, g in T.loc[tech_focus].groupby("Country").size().sort_values(ascending=False).head(5).items()}
R["segments"] = segs

# ---------- 8. data quality ----------
nonascii = T["Customer Feedback"].str.contains(r"[^\x00-\x7F]", regex=True)
R["data_quality"] = {
    "null_feedback_type_rows": int(df["Feedback Type"].isna().sum()),
    "null_taxonomy_rows": int(df["Vfc level2 Name"].isna().sum()),
    "no_class_found_rows": int((df["Vfc level2 Name"] == "no_class_found").sum()),
    "long_comments_gt1000chars": int((T["Customer Feedback"].str.len() > 1000).sum()),
    "max_comment_len": int(T["Customer Feedback"].str.len().max()),
    "median_comment_len": float(T["Customer Feedback"].str.len().median()),
    "ids_with_nonascii_text": int(nonascii.sum()),
    "us_share_of_unique_ids_pct": round(100 * countries[top_c] / n, 1),
    "countries": int(df["Country"].nunique()),
    "multi_topic_gt2000chars": int((T["Customer Feedback"].str.len() > 2000).sum()),
    "engine_label_note": "BEV appears as 'BEVE' in this export",
    "source_d_null_l2": int((df[df["Source"] == "Source D"]["Vfc level2 Name"].isna()).sum()),
    "feedbacktype_null_by_source": {str(k): int(v) for k, v in df[df["Feedback Type"].isna()].groupby("Source")["ID"].nunique().items()},
}

with open("research/data/A_g60_aggregates.json", "w") as f:
    json.dump(R, f, indent=1, ensure_ascii=False)
print("wrote research/data/A_g60_aggregates.json;", len(json.dumps(R)), "bytes")
# print key numbers for the report
print(json.dumps({k: R[k] for k in ("counts", "taxonomy", "segments", "data_quality")}, indent=1, ensure_ascii=False)[:6000])
