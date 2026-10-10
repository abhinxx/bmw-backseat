"""B_04: Feature-level signals via taxonomy AND text keywords (reported separately).

Run from project root. Writes research/data/B_g70_features.json.
Sentiment classes: Likes / Negative (Difficult to Use + Defect) / Wants / None-tagged.
'Keyword' = regex on Customer Feedback (case-insensitive). 'Taxonomy' = level2/level3/combined label match.
A UID counts for a feature if ANY of its rows matches; sentiment = per-row, uid-level any.
"""
import pandas as pd, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pd.read_pickle(OUT / "B_g70.pkl")
df["text"] = df["Customer Feedback"].astype(str).str.lower()
df["tax"] = (df["Vfc level2 Name"].fillna("").astype(str) + " | " +
             df["Vfc level3 Name"].fillna("").astype(str) + " | " +
             df["Vfc level2 3 Name"].fillna("").astype(str)).str.lower()
NEG = ["Difficult to Use", "Defect"]

FEATURES = {
  "rear_seat_experience": {
    "kw": r"rear seat|back seat|backseat|rear bench|executive lounge|rear entertainment|theatre screen|theater screen|rear seating| chauffeur|chauffeured|limo",
    "tax": r"rear seat|executive lounge|rear entertainment|theatre|rear bench",
  },
  "seat_heating_ventilation": {
    "kw": r"seat heating|heated seat|seat ventil|ventilated seat|seat cooler|seat cooling|heated and ventil",
    "tax": r"seat heating|heated seat|seat ventil|ventilated seat|seat climate",
  },
  "steering_wheel_heating": {
    "kw": r"heated steering|steering wheel heat",
    "tax": r"heated steering",
  },
  "exterior_colour_paint": {
    "kw": r"\bcolour|\bcolor\b|paint|two-tone|two tone|matte|mat\b|individual paint",
    "tax": r"colou?r|paint|two-tone",
  },
  "performance_power": {
    "kw": r"\bpower\b|acceleration|\bhp\b|horsepower|torque|\bspeed\b|quick|\bfast\b|passing|overtak|m\/s|0-60|0 to 60",
    "tax": r"power|acceleration|drivetrain|engine|motor|performance|driving dynamics|handling / riding|electric power",
  },
  "digital_infotainment_controls": {
    "kw": r"idrive|i-drive|icloud|infotainment|touchscreen|touch screen|carplay|android auto|operating system|os 8|version 8|software|menu|button|voice assist|intelligent assistant|bmw assistant|app\b",
    "tax": r"connecteddrive|infotainment|operating concept|touch screen|my bmw app|apple carplay|android auto|personal esim|voice operat|digital|remote services|operate",
  },
  "driver_assistance": {
    "kw": r"assist|highway assistant|assisted driving|lane assist|lane keeping|adaptive cruise|traffic jam assist|auto(matic)? parking|remote control parking|self.?parking|high beam assist|surround view|camera",
    "tax": r"assist|remote controlled parking|automated driving|park(ing)? (assist|function|system)|cruise|lane|camera|distance",
  },
  "range_charging": {
    "kw": r"\brange\b|charging|charge\b|charger|ev\b|battery|regenerat",
    "tax": r"electric range|charging|battery|recharge|energy",
  },
  "comfort_general": {
    "kw": r"comfort(able|ableness)?|\bspacious|legroom|quiet|noise|nvh|suspension|ride quality",
    "tax": r"interior comfort|space|cushioning|handling / riding|noise",
  },
}
res = {}
for name, pat in FEATURES.items():
    kw_rows = df[df.text.str.contains(pat["kw"], regex=True, na=False)]
    tax_rows = df[df.tax.str.contains(pat["tax"], regex=True, na=False)]
    def pack(rows):
        ids = set(rows.ID)
        like_ids = set(rows[rows["Feedback Type"] == "Likes"].ID)
        neg_ids = set(rows[rows["Feedback Type"].isin(NEG)].ID)
        want_ids = set(rows[rows["Feedback Type"] == "Wants"].ID)
        byc = rows.groupby("Country")["ID"].nunique().sort_values(ascending=False)
        return {"unique_ids": len(ids),
                "likes_ids": len(like_ids & ids), "negative_ids": len(neg_ids & ids),
                "wants_ids": len(want_ids & ids),
                "by_country": {k: int(v) for k, v in byc.head(6).items()},
                "rows": int(len(rows))}
    both = set(kw_rows.ID) & set(tax_rows.ID)
    union = set(kw_rows.ID) | set(tax_rows.ID)
    res[name] = {"keyword": pack(kw_rows), "taxonomy": pack(tax_rows),
                 "overlap_ids": len(both), "union_ids": len(union)}

# ---- behavioural segments ----
seg = {}
# S1 rear-seat engaged
s1 = set(df[df.text.str.contains(FEATURES["rear_seat_experience"]["kw"], na=False)].ID) | \
     set(df[df.tax.str.contains(FEATURES["rear_seat_experience"]["tax"], na=False)].ID)
seg["rear_seat_engaged"] = sorted(s1)
# S2 controls-frustrated: negative rows on control/infotainment taxonomy
ctl_tax = FEATURES["digital_infotainment_controls"]["tax"]
neg_ctl = df[(df["Feedback Type"].isin(NEG)) & (df.tax.str.contains(ctl_tax, na=False))]
seg["controls_frustrated_neg"] = sorted(set(neg_ctl.ID))
# among controls-frustrated, also a positive elsewhere? (ambivalent adopters)
posids = set(df[df["Feedback Type"] == "Likes"].ID)
seg["controls_frustrated_also_like"] = sorted(set(seg["controls_frustrated_neg"]) & posids)
# S3 app-digital-reliant: any row mentioning app/carplay/esim/remote (any sentiment)
app_kw = r"app\b|carplay|esim|remote|my bmw"
seg["digital_app_engaged"] = sorted(set(df[df.text.str.contains(app_kw, na=False)].ID))
# S4 range/charging-conscious BEV owners (negative on range/charging)
bev = set(df[df["Engine Type"] == "BEVE"].ID)
rc = df[df["Feedback Type"].isin(NEG) & df.text.str.contains(FEATURES["range_charging"]["kw"], na=False)]
seg["bev_range_concerned"] = sorted(set(rc.ID))
seg_sizes = {k: len(v) for k, v in seg.items()}
# KR/JP behaviour check
kr = set(df[df.Country == "KR"].ID); jp = set(df[df.Country == "JP"].ID)
seg_check = {
  "rear_seat_in_KR": len(s1 & kr), "rear_seat_in_JP": len(s1 & jp),
  "controls_neg_in_KR": len(set(seg["controls_frustrated_neg"]) & kr),
  "digital_app_in_KR": len(set(seg["digital_app_engaged"]) & kr),
}
res["_segments"] = {"sizes": seg_sizes, "country_check": seg_check,
                    "id_lists_sample": {k: v[:12] for k, v in seg.items()}}
(OUT / "B_g70_features.json").write_text(json.dumps(res, indent=1, ensure_ascii=False, default=str))
for k, v in res.items():
    if k.startswith("_"): continue
    print(k, "| kw uid", v["keyword"]["unique_ids"], "L/N/W", v["keyword"]["likes_ids"], v["keyword"]["negative_ids"], v["keyword"]["wants_ids"],
          "| tax uid", v["taxonomy"]["unique_ids"], "L/N", v["taxonomy"]["likes_ids"], v["taxonomy"]["negative_ids"],
          "| union", v["union_ids"])
print(json.dumps(res["_segments"]["sizes"]), json.dumps(seg_check))
print("rear-seat kw by_country:", res["rear_seat_experience"]["keyword"]["by_country"])
print("rear-seat tax by_country:", res["rear_seat_experience"]["taxonomy"]["by_country"])
print("digital kw by_country:", res["digital_infotainment_controls"]["keyword"]["by_country"])
print("assistance kw by_country:", res["driver_assistance"]["keyword"]["by_country"])
print("seat_hv kw:", res["seat_heating_ventilation"]["keyword"]["by_country"], "tax:", res["seat_heating_ventilation"]["taxonomy"]["by_country"], res["seat_heating_ventilation"]["keyword"]["likes_ids"], res["seat_heating_ventilation"]["keyword"]["negative_ids"])
