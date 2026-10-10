"""D3: Source profiles, language mix, coverage matrix, synthetic signals,
plus corrected Feedback-Type x level3-prefix crosstab (D2 polarity mapping
assumed 'Positive'/'Negative' strings that don't exist in this data)."""
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
# one row per unique comment (ID x text dedupe: first row per ID)
com = df.drop_duplicates(["Model", "ID"]).copy()

report = {}

# --- corrected FT x level3-prefix crosstab ---------------------------------
ftx = {}
POL = {"Likes": "pos", "Difficult to Use": "neg", "Defect": "neg", "Wants": "want"}
for model, g in df.groupby("Model"):
    g3 = g.dropna(subset=["Vfc level3 Name"]).copy()
    pref = g3["Vfc level3 Name"].astype(str).map(
        lambda s: "Like:" if s.startswith("Like:") else ("Dislike:" if s.startswith("Dislike:") else "other"))
    ct = pd.crosstab(pref, g3["Feedback Type"].fillna("<NULL>"))
    ftx[model] = ct.to_dict()
    # mismatch definition: Like: prefix but FT not 'Likes'; Dislike: prefix but FT not in {Difficult to Use, Defect}
    like_bad = ((pref == "Like:") & (g3["Feedback Type"] != "Likes")).sum()
    dis_bad = ((pref == "Dislike:") & (~g3["Feedback Type"].isin(["Difficult to Use", "Defect"]))).sum()
    ftx[model]["_mismatch_Like_not_Likes"] = int(like_bad)
    ftx[model]["_mismatch_Dislike_not_neg_usecase"] = int(dis_bad)
report["ft_prefix_crosstab"] = ftx

# --- 5. Source profiles ----------------------------------------------------
AG_RE = re.compile(r"^(customer (stated|mentioned|commented|said|stated that|mentioned that))", re.I)
FP_RE = re.compile(r"\b(i|my|we)\b", re.I)
src = {}
for (model, s), g in df.groupby(["Model", "Source"]):
    g = g.drop_duplicates("ID")
    texts = g["Customer Feedback"].fillna("").astype(str)
    L = texts.str.len()
    src[f"{model}|{s}"] = {
        "comments": int(len(g)),
        "median_len": float(L.median()),
        "agent_transcribed_share": float(texts.str.match(AG_RE).mean()),
        "first_person_share": float(texts.str.contains(r"(^|\W)(i|my|we)\W", case=False).mean()),
        "countries": {str(k): int(v) for k, v in g["Country"].value_counts().items()},
        "feedback_type_mix": {str(k): int(v) for k, v in g["Feedback Type"].fillna("<NULL>").value_counts().items()},
        "engine_mix": {str(k): int(v) for k, v in g["Engine Type"].value_counts().items()},
        "example_ids": sorted(str(x) for x in g["ID"].head(3)),
    }
report["source_by_model"] = src
# pooled across models per source
srcp = {}
for s, g in df.drop_duplicates(["Model", "ID"]).groupby("Source"):
    texts = g["Customer Feedback"].fillna("").astype(str)
    srcp[s] = {
        "comments": int(len(g)),
        "median_len": float(texts.str.len().median()),
        "agent_transcribed_share": round(float(texts.str.match(AG_RE).mean()), 3),
        "first_person_share": round(float(texts.str.contains(r"(^|\W)(i|my|we)\W", case=False).mean()), 3),
        "top_countries": {str(k): int(v) for k, v in g["Country"].value_counts().head(6).items()},
        "feedback_type_mix": {str(k): int(v) for k, v in g["Feedback Type"].fillna("<NULL>").value_counts().items()},
        "sample_texts": [t[:160] for t in g["Customer Feedback"].dropna().sample(min(3, len(g)), random_state=1)],
    }
report["source_pooled"] = srcp

# --- 6. Language heuristic ---------------------------------------------------
WORDS = {
    "de": ["das", "die", "und", "ist", "nicht", "mit", "für", "sehr", "aber", "mein", "vehicle" , "der", "ein"],
    "fr": ["le", "la", "les", "est", "pas", "très", "mais", "mon", "avec", "pour", "une", "j'aime"],
    "sv": ["och", "att", "det", "inte", "mycket", "min", "med", "är", "den", "har"],
    "ja_kana": None,
}


def lang_heuristic(t):
    if not isinstance(t, str) or not t.strip():
        return "empty"
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t):
        return "ja/zh"
    if re.search(r"[\uac00-\ud7af]", t):
        return "ko"
    low = " " + t.lower() + " "
    scores = {
        "de": sum(low.count(f" {w} ") for w in ["das", "die", "und", "ist", "nicht", "mit", "für", "sehr", "mein", "aber"]),
        "fr": sum(low.count(f" {w} ") for w in ["le", "la", "les", "pas", "très", "mais", "mon", "avec", "une", "est"]),
        "sv": sum(low.count(f" {w} ") for w in ["och", "att", "det", "inte", "mycket", "min", "är", "har", "med"]),
        "en": sum(low.count(f" {w} ") for w in ["the", "and", "is", "not", "my", "very", "but", "i ", " it ", "to "]),
    }
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "other/unknown"
    # ambiguous if best barely ahead
    srt = sorted(scores.values(), reverse=True)
    return best + ("?" if srt[0] <= srt[1] + 1 else "")


for model, g in df.groupby("Model"):
    gg = g.drop_duplicates("ID")
    lg = gg["Customer Feedback"].map(lang_heuristic)
    report.setdefault("language_by_model", {})[model] = {str(k): int(v) for k, v in lg.value_counts().items()}
    per_country = {}
    for c, gc in gg.groupby("Country"):
        per_country[c] = {str(k): int(v) for k, v in gc["Customer Feedback"].map(lang_heuristic).value_counts().items()}
    report.setdefault("language_by_country", {})[model] = per_country

# --- 7. Coverage matrix (unique IDs) -----------------------------------------
cov = pd.pivot_table(com, index=["Model", "Country"], columns="Source",
                     values="ID", aggfunc="nunique", fill_value=0)
report["coverage_matrix"] = {"table": {str(k): {str(c): int(v) for c, v in row.items()} for k, row in cov.iterrows()},
                             "thin_cells_lt30": [f"{k}|{c}:{v}" for k, row in cov.iterrows() for c, v in row.items() if 0 < v < 30],
                             "zero_cells": [f"{k}|{c}:0" for k, row in cov.iterrows() for c, v in row.items() if v == 0]}

# --- 8. Synthetic signals ------------------------------------------------------
syn = {}
for model, g in df.groupby("Model"):
    gg = g.drop_duplicates("ID")
    t = gg["Customer Feedback"].fillna("").astype(str)
    m = {}
    m["comments"] = int(len(gg))
    m["nps_prompt_frame"] = int(t.str.contains("primary reason for your nps", case=False).sum())
    m["one_comment_frame"] = int(t.str.contains("if there was one comment", case=False).sum())
    m["agent_stated_frame"] = int(t.str.match(AG_RE).sum())
    # most common leading 5-word prefixes
    lead = t.map(lambda x: " ".join(norm(x).split()[:5]))
    vc = lead.value_counts()
    m["top_leading5word_prefixes"] = {k: int(v) for k, v in vc.head(8).items() if v > 3}
    # most common full texts
    tv = t.str.lower().str.strip().value_counts()
    m["top_exact_texts"] = {k[:100]: int(v) for k, v in tv.head(6).items() if v > 1}
    # identical tail phrases (last 6 words)
    tail = t.map(lambda x: " ".join(norm(x).split()[-6:]) if len(norm(x).split()) >= 6 else "")
    m["top_trailing6word"] = {k: int(v) for k, v in tail.value_counts().head(6).items() if v > 3}
    # ID format
    m["id_format_sample"] = sorted(gg["ID"].astype(str))[:2] + sorted(gg["ID"].astype(str))[-2:]
    m["id_sequential"] = bool(all(re.fullmatch(r"[A-Z]\d{4}-\d{4}", str(x)) for x in gg["ID"].head(50)))
    # Sales Description values (survey instrument?)
    m["sales_description_top"] = {str(k): int(v) for k, v in gg["Sales Description"].value_counts().head(6).items()}
    syn[model] = m
report["synthetic_signals"] = syn

with open(OUT / "D3_sources_lang.json", "w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in report["source_pooled"].items()}, indent=1)[:2500])
print("LANG:", json.dumps(report["language_by_model"]))
print("COV thin:", report["coverage_matrix"]["thin_cells_lt30"][:20])
print("COV zero:", report["coverage_matrix"]["zero_cells"][:30])
print("SYN G60:", json.dumps(report["synthetic_signals"]["G60"], indent=1)[:1500])
print("FTX F70:", json.dumps(ftx["F70"], indent=1)[:600])
