"""D6: Merge D1-D4 outputs into the machine-readable research/data/D_audit.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
d1 = json.load(open(OUT / "D1_profile.json"))
d2 = json.load(open(OUT / "D2_dup_taxonomy.json"))
d3 = json.load(open(OUT / "D3_sources_lang.json"))
d4 = json.load(open(OUT / "D4_residual.json"))

audit = {
    "meta": {"generated_by": "research/scripts/D6_audit_merge.py (inputs D1-D4 scripts)",
             "files": ["G60_feedback_hackathon.xlsx", "G70_feedback_hackathon.xlsx",
                       "F70_feedback_hackathon.xlsx"], "sheet": "Feedback_Explorer"},
    "s1_per_file": {
        m: {"rows": d1[m]["rows"], "unique_IDs": d1[m]["unique_ID"],
            "unique_texts": d1[m]["unique_CustomerFeedback"],
            "unique_norm_texts": d2["duplication"][m]["unique_norm_texts"],
            "null_rate_by_col": d1[m]["null_rate_by_col"],
            "id_row_multiplicity": d1[m]["id_row_multiplicity"],
            "categoricals": {k[len("distinct_"):]: d1[m][k] for k in d1[m] if k.startswith("distinct_")}}
        for m in ["G60", "G70", "F70"]},
    "s2_duplication": {"within_file": d2["duplication"],
                       "cross_file_exact_text": d2["cross_file_exact_text_dupes"],
                       "id_contiguity": d4["id_contiguity"],
                       "per_id_attribute_consistency": d4["per_id_attribute_consistency"]},
    "s3_vfc_combined_consistency": d2["vfc_consistency"],
    "s4_taxonomy": {"level2": d2["taxonomy"]["level2"],
                    "level3": {k: d2["taxonomy"][k] for k in
                               ["level3_distinct_counts", "level3_common_all3_n", "level3_union_n"]},
                    "ft_x_level3_prefix_crosstab": d3["ft_prefix_crosstab"],
                    "level3_prefix_grammar": d4["level3_prefix_grammar"]},
    "s5_sources": {"pooled": d3["source_pooled"], "by_model": d3["source_by_model"],
                   "null_patterns": d4["null_patterns"]},
    "s6_language": {"by_model": d3["language_by_model"], "by_country": d3["language_by_country"]},
    "s7_coverage": d3["coverage_matrix"],
    "s8_synthetic_signals": d3["synthetic_signals"],
}
with open(OUT / "D_audit.json", "w") as f:
    json.dump(audit, f, indent=1, ensure_ascii=False)
print("wrote D_audit.json", (OUT / "D_audit.json").stat().st_size, "bytes; keys:", list(audit))
