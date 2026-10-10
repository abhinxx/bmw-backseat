"""B_06: Corrected taxonomy counts for seat heat/vent + rear-seat sublabels. Writes B_g70_features2.json."""
import pandas as pd, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pd.read_pickle(OUT / "B_g70.pkl")
taxl = (df["Vfc level2 3 Name"].fillna("").astype(str)).str.lower()
NEG = ["Difficult to Use", "Defect"]
res = {}
def pack(mask):
    s = df[mask]
    return {"unique_ids": int(s.ID.nunique()),
            "likes": int(s[s["Feedback Type"] == "Likes"].ID.nunique()),
            "negative": int(s[s["Feedback Type"].isin(NEG)].ID.nunique()),
            "wants": int(s[s["Feedback Type"] == "Wants"].ID.nunique()),
            "by_country": {k: int(v) for k, v in s.groupby("Country")["ID"].nunique().items()}}
res["tax_seating_ventilate_heat"] = pack(taxl.str.contains("seating, ventilate / heat"))
res["tax_rear_seat_entertainment"] = pack(taxl.str.contains("rear seat entertainment"))
res["tax_seat_massage"] = pack(taxl.str.contains("seat massage"))
res["tax_headrests_rear"] = pack(taxl.str.contains("headrests, rear"))
# executive lounge / rear comfort via text
txt = df["Customer Feedback"].astype(str).str.lower()
res["kw_executive_lounge"] = pack(txt.str.contains("executive lounge"))
res["kw_theatre_screen"] = pack(txt.str.contains("theatre|theater screen"))
res["kw_chauffeur"] = pack(txt.str.contains("chauffeur|chauffeured|driver (of|for) me|my driver"))
res["kw_rear_seat_general"] = pack(txt.str.contains("rear seat|back seat|backseat|rear seating"))
# negative rear-seat quotes
s = df[(txt.str.contains("rear seat|back seat|backseat|executive lounge|rear entertainment|theatre|theater")) & df["Feedback Type"].isin(NEG)]
res["neg_rearseat_uid"] = int(s.ID.nunique())
res["neg_rearseat_examples"] = [{"ID": r.ID, "t": str(r["Customer Feedback"])[:200], "fb": str(r["Feedback Type"]), "lbl": str(r["Vfc level2 3 Name"])[:60]} for _, r in s.sample(min(8, len(s)), random_state=1).iterrows()]
# seat heat/vent text quotes (both signs)
sh = df[txt.str.contains("seat heating|heated seat|seat ventil|ventilated seat")]
res["seathv_examples"] = [{"ID": r.ID, "t": str(r["Customer Feedback"])[:200], "fb": str(r["Feedback Type"])} for _, r in sh.sample(min(8, len(sh)), random_state=1).iterrows()]
(OUT / "B_g70_features2.json").write_text(json.dumps(res, indent=1, ensure_ascii=False, default=str))
print(json.dumps(res, indent=1, ensure_ascii=False)[:4000])
