"""C_05: Behavioural segments + country differences.
Segments are defined purely on observable feedback behaviour. No demographics.
Writes C_f70_segments.json."""
import json, statistics
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_pickle(f"{ROOT}/research/data/C_f70.pkl")
df["_text_norm"] = df["Customer Feedback"].astype(str).str.strip().str.lower()
ft = df["Feedback Type"].astype(str)
df["_is_like"] = ft == "Likes"
df["_is_neg"] = ft.isin({"Defect", "Difficult to Use", "Wants"})
df["_is_defect"] = ft == "Defect"
df["_is_wants"] = ft == "Wants"
df["_is_diff"] = ft == "Difficult to Use"
L2 = "Vfc level2 Name"
out = {}

ids = df.drop_duplicates("ID")[["ID", "Country"]].set_index("ID")
df["_tlen"] = df["_text_norm"].str.len()
byid = df.groupby("ID").agg(any_like=("_is_like", "any"), any_neg=("_is_neg", "any"),
                            any_defect=("_is_defect", "any"), any_wants=("_is_wants", "any"),
                            any_diff=("_is_diff", "any"), text_len=("_tlen", "max"))
byid["Country"] = ids["Country"]

# --- valence-based segments (mutually exclusive) ---
byid["valence"] = "unclassified_only"
byid.loc[byid.any_like & ~byid.any_neg, "valence"] = "praise_only"
byid.loc[~byid.any_like & byid.any_neg, "valence"] = "complaint_only"
byid.loc[byid.any_like & byid.any_neg, "valence"] = "mixed_praise_and_complaint"
out["valence_segments"] = byid["valence"].value_counts().to_dict()
out["valence_x_country"] = pd.crosstab(byid["valence"], byid["Country"]).to_dict()

# --- behavioural overlays (can overlap) ---
DIGITAL_L2 = ["Touch screen, operation", "ConnectedDrive and Infotainment, overall technology",
              "Controller operation", "Multi-function steering wheel operation",
              "Voice control / speech recognition", "Navigation", "My Modes / driving dynamics experience",
              "My Modes / driving experience", "Intelligent Personal Assistant", "My BMW App / MINI App",
              "Touch Command", "Instrument cluster", "Owner's Manual"]
DYN_L2 = ["Drive, driving dynamics and chassis, overall technology", "Drivetrain",
          "Handling / Riding", "Steering", "Braking"]

def ids_where(mask): return set(df[mask]["ID"])
seg = {}
seg["S1_digital_friction"] = ids_where(df["_is_neg"] & df[L2].isin(DIGITAL_L2))
seg["S2_quality_defect_reporter"] = ids_where(df["_is_defect"])
seg["S3_feature_requester"] = ids_where(df["_is_wants"])
seg["S4_driving_dynamics_advocate"] = ids_where(df["_is_like"] & df[L2].isin(DYN_L2))
seg["S5_hard_to_use_reporter"] = ids_where(df["_is_diff"])
thr = byid["text_len"].quantile(0.75)
seg["S6_detailed_longform_reviewer"] = set(byid[byid["text_len"] >= thr].index)
seg["S7_manual_docs_struggler"] = ids_where(df["_is_neg"] & (df[L2] == "Owner's Manual"))
out["overlay_segments"] = {k: {"unique_ids": int(len(v)), "pct_of_2128": round(100 * len(v) / len(byid), 1),
                               "by_country": {str(c): int(n) for c, n in
                                              pd.Series(ids.loc[list(v), "Country"]).value_counts().head(6).items()}}
                           for k, v in seg.items()}
out["text_len_p75_chars"] = float(thr)
out["overlay_overlaps"] = {f"{a}&{b}": int(len(seg[a] & seg[b]))
                           for a in seg for b in seg if a < b and len(seg[a] & seg[b]) >= 20}

# --- country differences: theme prevalence (unique-ID share within country), n>=30 filter ---
big = ["GB", "JP"]  # SE(71), FR(53) shown but flagged small
out["country_theme_prevalence"] = {}
for c, n in [("GB", (byid.Country == "GB").sum()), ("JP", (byid.Country == "JP").sum()),
            ("SE", (byid.Country == "SE").sum()), ("FR", (byid.Country == "FR").sum())]:
    d = df[df["Country"] == c]
    rows = []
    for lab, g in d[d[L2].notna() & (d[L2].astype(str) != "no_class_found") & d["_is_neg"]].groupby(L2):
        u = g["ID"].nunique()
        if u >= 10:
            rows.append({"theme": lab, "unique_ids": int(u), "pct_of_country_ids": round(100 * u / n, 1)})
    rows.sort(key=lambda r: -r["pct_of_country_ids"])
    out["country_theme_prevalence"][c] = {"country_unique_ids": int(n), "top_negative_themes": rows[:12]}

# like-side prevalence too
for c, n in [("GB", int((byid.Country == "GB").sum())), ("JP", int((byid.Country == "JP").sum()))]:
    d = df[df["Country"] == c]
    rows = []
    for lab, g in d[d[L2].notna() & (d[L2].astype(str) != "no_class_found") & d["_is_like"]].groupby(L2):
        u = g["ID"].nunique()
        if u >= 10:
            rows.append({"theme": lab, "unique_ids": int(u), "pct_of_country_ids": round(100 * u / n, 1)})
    rows.sort(key=lambda r: -r["pct_of_country_ids"])
    out.setdefault("country_like_prevalence", {})[c] = rows[:10]

with open(f"{ROOT}/research/data/C_f70_segments.json", "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False, default=lambda o: int(o))
print("valence:", out["valence_segments"])
print("overlays:", {k: v["unique_ids"] for k, v in out["overlay_segments"].items()})
print("GB neg top:", [(r['theme'], r['pct_of_country_ids']) for r in out['country_theme_prevalence']['GB']['top_negative_themes'][:8]])
print("JP neg top:", [(r['theme'], r['pct_of_country_ids']) for r in out['country_theme_prevalence']['JP']['top_negative_themes'][:8]])
