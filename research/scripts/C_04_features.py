"""C_04: Feature-level signals. Taxonomy counts vs keyword-in-text counts, unique IDs,
like/neg split, by country. Keyword counts on deduplicated (ID,text) rows to avoid
double counting multi-category rows. Writes C_f70_features.json."""
import json, re
import pandas as pd

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
df = pd.read_pickle(f"{ROOT}/research/data/C_f70.pkl")
df["_text_norm"] = df["Customer Feedback"].astype(str).str.strip().str.lower()
ft = df["Feedback Type"].astype(str)
df["_is_like"] = ft == "Likes"
df["_is_neg"] = ft.isin({"Defect", "Difficult to Use", "Wants"})
L2, L23 = "Vfc level2 Name", "Vfc level2 3 Name"

# one row per (ID, text) with OR-aggregated flags for keyword matching (text-level)
texts = (df.groupby(["ID", "Country", "_text_norm"])
           .agg(any_like=("_is_like", "any"), any_neg=("_is_neg", "any")).reset_index())

def count_block(idset, like_ids, neg_ids):
    d = df[df["ID"].isin(idset)]
    byc = {c: int(g["ID"].nunique()) for c, g in d.groupby("Country") if g["ID"].nunique() >= 3}
    return {"unique_ids": len(idset), "unique_ids_like": len(like_ids & idset),
            "unique_ids_negative": len(neg_ids & idset), "by_country": dict(sorted(byc.items(), key=lambda x: -x[1]))}

FEATURES = {
  "rear_seat_comfort_space": {
    "kw": [r"rear seat", r"back seat", r"rear bench", r"rear passenger", r"sitzbank hinten", r"back seat"],
    "tax_l2": ["Seats", "Space / spatial impression", "Headrests, rear"],
    "tax_l23_sub": [r"rear", r"back seat"]},
  "seat_heating": {
    "kw": [r"seat heating", r"heated seat", r"seat heater", r"heating.*seat", r"sitzheizung"],
    "tax_l2": ["Seating, ventilate / heat", "Seat massage"], "tax_l23_sub": [r"heat", r"ventilate"]},
  "exterior_colour_paint": {
    "kw": [r"\bcolour", r"\bcolor", r"paint", r"lackierung", r"farbe", r"\bpaintwork", r"\bmatte\b", r"matt paint"],
    "tax_l2": ["Exterior", "Exterior design"], "tax_l23_sub": [r"colour", r"color", r"paint"]},
  "performance_power": {
    "kw": [r"\bpower\b", r"acceleration", r"\bfast\b", r"\bpunch", r"torque", r"performance", r"pickup", r"pick-up", r"lethargic", r"sluggish"],
    "tax_l2": ["Drivetrain", "Engine", "Transmission"], "tax_l23_sub": [r"acceleration", r"power", r"performance"]},
  "digital_idrive_infotainment_controls": {
    "kw": [r"\bidrive\b", r"\bipo\b", r"infotainment", r"touch ?screen", r"touchscreen", r"\bmenu", r"\bbutton", r"software", r"\bapp\b", r"\bos\b", r"carplay", r"android auto", r"\bdisplay", r"complicated", r"\bconfus"],
    "tax_l2": ["Touch screen, operation", "ConnectedDrive and Infotainment, overall technology", "Controller operation", "Multi-function steering wheel operation", "Voice control / speech recognition", "Navigation", "My Modes / driving experience", "Intelligent Personal Assistant", "My BMW App / MINI App", "iDrive and Control Display", "Operation and driver information, overall technology", "Touch Command", "Instrument cluster"],
    "tax_l23_sub": []},
  "driver_assistance": {
    "kw": [r"lane.?(keeping|assist|departure)", r"adaptive cruise", r"\bcruise control\b", r"parking assist", r"driver assist", r"\bassistent", r"emergency brake", r"lane change assist", r"reversing assist", r"traffic jam assist", r"blind spot", r"\bcamera\b", r"park distance"],
    "tax_l2": ["(Active) cruise control", "Blind spot monitoring", "Lane departure warning", "Parking Assistant", "Park Distance Control (PDC)", "Rear view camera", "Rear-end collision warning", "Speed Limit Assistant", "Back-up Assistant", "Driver assistance, automated driving, overall technology", "All-round view"],
    "tax_l23_sub": []},
  "price_value": {
    "kw": [r"\bprice", r"\bvalue\b", r"\bmoney", r"expensive", r"\bcost", r"afford", r"worth it", r"good value", r"teuer", r"value for money"],
    "tax_l2": ["Price-value ratio"], "tax_l23_sub": [r"price", r"value"]},
}

# List actual level2 labels containing hints to map taxonomy properly
all_l2 = set(df[L2].dropna().unique())
out = {"level2_labels_available": sorted(all_l2)}

res = {}
for name, spec in FEATURES.items():
    pat = re.compile("|".join(f"(?:{k})" for k in spec["kw"]))
    # keyword path (text level, dedup)
    m = texts[texts["_text_norm"].str.contains(pat, regex=True)]
    kw_ids = set(m["ID"])
    kw_like = set(m[m["any_like"]]["ID"]); kw_neg = set(m[m["any_neg"]]["ID"])
    # taxonomy path: level2 in list OR level23 label matches sub-regex
    taxmask = df[L2].isin(spec["tax_l2"])
    if spec["tax_l23_sub"]:
        sub = re.compile("|".join(spec["tax_l23_sub"]), re.I)
        taxmask |= df[L23].astype(str).str.contains(sub, na=False)
    td = df[taxmask]
    tax_ids = set(td["ID"]); tax_like = set(td[td["_is_like"]]["ID"]); tax_neg = set(td[td["_is_neg"]]["ID"])
    both = tax_ids | kw_ids
    bd = df[df["ID"].isin(both)]
    both_like = set(bd[bd["_is_like"]]["ID"]); both_neg = set(bd[bd["_is_neg"]]["ID"])
    def byc(idset):
        d = df[df["ID"].isin(idset)]
        return {c: int(g["ID"].nunique()) for c, g in d.groupby("Country") if g["ID"].nunique() >= 3}
    res[name] = {
        "taxonomy": {"unique_ids": len(tax_ids), "like": len(tax_like & tax_ids), "negative": len(tax_neg & tax_ids), "by_country": byc(tax_ids)},
        "keyword": {"unique_ids": len(kw_ids), "like": len(kw_like & kw_ids), "negative": len(kw_neg & kw_ids), "by_country": byc(kw_ids)},
        "combined_union": {"unique_ids": len(both), "like": len(both_like), "negative": len(both_neg), "overlap_tax_and_kw": len(tax_ids & kw_ids), "by_country": byc(both)},
        "kw_matched": int(m["_text_norm"].nunique()),
    }
out["features"] = res
with open(f"{ROOT}/research/data/C_f70_features.json", "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
for k, v in res.items():
    print(k, "tax:", v["taxonomy"]["unique_ids"], "kw:", v["keyword"]["unique_ids"], "union:", v["combined_union"]["unique_ids"],
          "L/D(union):", v["combined_union"]["like"], "/", v["combined_union"]["negative"])
print()
print("sample unmatched level2 labels:", sorted(all_l2)[:60])
