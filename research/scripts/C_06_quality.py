"""C_06: Data-quality diagnostics + per-feature per-country like/dislike split.
Writes C_f70_quality.json and C_f70_features_byc.json."""
import json, re
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_pickle(f"{ROOT}/research/data/C_f70.pkl")
df["_text_norm"] = df["Customer Feedback"].astype(str).str.strip().str.lower()
ft = df["Feedback Type"].astype(str)
df["_is_like"] = ft == "Likes"
df["_is_neg"] = ft.isin({"Defect", "Difficult to Use", "Wants"})
L2 = "Vfc level2 Name"
out = {}

# ID continuity
ids = sorted(df["ID"].unique())
nums = [int(i.split("-")[1]) for i in ids]
out["id_min"], out["id_max"] = ids[0], ids[-1]
out["id_expected_count"] = max(nums) - min(nums) + 1
out["id_actual_count"] = len(nums)
out["id_gaps"] = max(nums) - min(nums) + 1 - len(nums)

# empty / placeholder texts
out["empty_or_nan_texts"] = int((df["_text_norm"].isin(["", "nan", "none"])).sum())
out["rows_nan_feedback_type"] = int((ft == "nan").sum())
out["rows_nan_level2"] = int(df[L2].isna().sum())

# text length stats per unique ID (max across rows)
df["_tlen"] = df["_text_norm"].str.len()
byid = df.groupby("ID").agg(tlen=("_tlen", "max"))
out["text_len_per_id"] = {"mean": round(float(byid.tlen.mean()), 1),
                          "median": float(byid.tlen.median()),
                          "p25": float(byid.tlen.quantile(0.25)),
                          "p75": float(byid.tlen.quantile(0.75)),
                          "max": int(byid.tlen.max()),
                          "min": int(byid.tlen.min()),
                          "lt30_chars": int((byid.tlen < 30).sum())}

# CJK share by country (keyword-path coverage caveat)
cjk = df.drop_duplicates("ID").copy()
cjk["has_cjk"] = cjk["_text_norm"].str.contains(r"[\u3040-\u30ff\u4e00-\u9fff]", regex=True)
out["cjk_by_country"] = {str(c): {"ids": int(len(g)), "cjk_texts": int(g["has_cjk"].sum())}
                         for c, g in cjk.groupby("Country")}

# non-ascii share in GB (German/French leftovers?)
gb = cjk[cjk["Country"] == "GB"]
out["gb_nonascii_ids"] = int(gb["_text_norm"].str.contains(r"[^\x00-\x7f]", regex=True).sum())

# 'General enquiry' catch-all size (rows/IDs, negative)
ge = df[df[L2] == "General enquiry: customer feedback"]
out["general_enquiry"] = {"rows": int(len(ge)), "unique_ids": int(ge["ID"].nunique()),
                          "negative_ids": int(ge[ge["_is_neg"]]["ID"].nunique())}

# Likes rows vs IDs sanity: rows carrying Likes and IDs carrying Likes
out["rows_like"] = int(df["_is_like"].sum())
out["ids_like"] = int(df[df["_is_like"]]["ID"].nunique())
out["ids_negative"] = int(df[df["_is_neg"]]["ID"].nunique())

with open(f"{ROOT}/research/data/C_f70_quality.json", "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False, default=lambda o: int(o))

# --- per-feature per-country like/dislike on the UNION id set ---
feat = json.load(open(f"{ROOT}/research/data/C_f70_features.json"))
byc_split = {}
for name, v in feat["features"].items():
    # rebuild union id set by replaying C_04 logic cheaply: taxonomy OR keyword
    pass
# replay is in C_04; instead recompute union via same rules quickly:
import importlib.util
# (C_04 has no reusable function; recompute the taxonomy+keyword masks here with the same specs)
L23 = "Vfc level2 3 Name"
texts = (df.groupby(["ID", "Country", "_text_norm"])
           .agg(any_like=("_is_like", "any"), any_neg=("_is_neg", "any")).reset_index())
FEATURES = json.load(open(f"{ROOT}/research/data/C_f70_specs.json")) if False else None
# spec copied verbatim from C_04 (single source of truth is C_04; keep in sync)
SPEC = {
  "rear_seat_comfort_space": {"kw": [r"rear seat", r"back seat", r"rear bench", r"rear passenger", r"sitzbank hinten"], "tax_l2": ["Seats", "Space / spatial impression", "Headrests, rear"], "tax_l23_sub": [r"rear", r"back seat"]},
  "seat_heating": {"kw": [r"seat heating", r"heated seat", r"seat heater", r"heating.*seat", r"sitzheizung"], "tax_l2": ["Seating, ventilate / heat", "Seat massage"], "tax_l23_sub": [r"heat", r"ventilate"]},
  "exterior_colour_paint": {"kw": [r"\bcolour", r"\bcolor", r"paint", r"lackierung", r"farbe", r"\bpaintwork", r"\bmatte\b", r"matt paint"], "tax_l2": ["Exterior", "Exterior design"], "tax_l23_sub": [r"colour", r"color", r"paint"]},
  "performance_power": {"kw": [r"\bpower\b", r"acceleration", r"\bfast\b", r"\bpunch", r"torque", r"performance", r"pickup", r"pick-up", r"lethargic", r"sluggish"], "tax_l2": ["Drivetrain", "Engine", "Transmission"], "tax_l23_sub": [r"acceleration", r"power", r"performance"]},
  "digital_idrive_infotainment_controls": {"kw": [r"\bidrive\b", r"\bipo\b", r"infotainment", r"touch ?screen", r"touchscreen", r"\bmenu", r"\bbutton", r"software", r"\bapp\b", r"\bos\b", r"carplay", r"android auto", r"\bdisplay", r"complicated", r"\bconfus"], "tax_l2": ["Touch screen, operation", "ConnectedDrive and Infotainment, overall technology", "Controller operation", "Multi-function steering wheel operation", "Voice control / speech recognition", "Navigation", "My Modes / driving experience", "Intelligent Personal Assistant", "My BMW App / MINI App", "iDrive and Control Display", "Operation and driver information, overall technology", "Touch Command", "Instrument cluster"], "tax_l23_sub": []},
  "driver_assistance": {"kw": [r"lane.?(keeping|assist|departure)", r"adaptive cruise", r"\bcruise control\b", r"parking assist", r"driver assist", r"\bassistent", r"emergency brake", r"lane change assist", r"reversing assist", r"traffic jam assist", r"blind spot", r"\bcamera\b", r"park distance"], "tax_l2": ["(Active) cruise control", "Blind spot monitoring", "Lane departure warning", "Parking Assistant", "Park Distance Control (PDC)", "Rear view camera", "Rear-end collision warning", "Speed Limit Assistant", "Back-up Assistant", "Driver assistance, automated driving, overall technology", "All-round view"], "tax_l23_sub": []},
  "price_value": {"kw": [r"\bprice", r"\bvalue\b", r"\bmoney", r"expensive", r"\bcost", r"afford", r"worth it", r"good value", r"teuer", r"value for money"], "tax_l2": ["Price-value ratio"], "tax_l23_sub": [r"price", r"value"]},
}
res = {}
for name, spec in SPEC.items():
    pat = re.compile("|".join(f"(?:{k})" for k in spec["kw"]))
    kw_ids = set(texts[texts["_text_norm"].str.contains(pat, regex=True)]["ID"])
    taxmask = df[L2].isin(spec["tax_l2"])
    if spec["tax_l23_sub"]:
        sub = re.compile("|".join(spec["tax_l23_sub"]), re.I)
        taxmask |= df[L23].astype(str).str.contains(sub, na=False)
    union = set(df[taxmask]["ID"]) | kw_ids
    assert len(union) == feat["features"][name]["combined_union"]["unique_ids"], name
    d = df[df["ID"].isin(union)]
    split = {}
    for c, g in d.groupby("Country"):
        u = g["ID"].nunique()
        if u >= 5:
            split[c] = {"ids": int(u),
                        "like": int(g[g["_is_like"]]["ID"].nunique()),
                        "negative": int(g[g["_is_neg"]]["ID"].nunique())}
    res[name] = dict(sorted(split.items(), key=lambda x: -x[1]["ids"]))
with open(f"{ROOT}/research/data/C_f70_features_byc.json", "w") as f:
    json.dump(res, f, indent=1, ensure_ascii=False)
print("quality OK:", json.dumps({k: v for k, v in out.items() if k in ("id_min","id_max","id_actual_count","id_gaps","empty_or_nan_texts","rows_nan_feedback_type","rows_nan_level2","gb_nonascii_ids","general_enquiry","rows_like","ids_like","ids_negative","text_len_per_id")}, ensure_ascii=False)[:900])
print("cjk:", out["cjk_by_country"])
print("features_byc OK for:", list(res))
