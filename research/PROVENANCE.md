# Research provenance: input file -> script -> output

Generated from an actual re-run of every saved script with Python's file-open audit hook
(`research/scripts/Z_trace_io.py` -> `research/data/Z_io_trace.json`), not from the scripts' source text.
All paths relative to the repo root. `d/` = `research/data/`. Raw inputs in `BMW-Data/` are read-only.

## A. Saved scripts (re-run on 2026-10-10 22:46, all ran)

| # | Raw input read | Script executed | Output written |
|---|---|---|---|
| A1 | `d/A_g60_feedback_explorer.csv` (1) | `research/scripts/A_explore.py` | none (prints only) |
| A2 | `d/A_g60_feedback_explorer.csv` (1) | `research/scripts/A_aggregate.py` | `d/A_g60_aggregates.json` |
| B1 | `BMW-Data/G70_feedback_hackathon.xlsx` | `research/scripts/B_01_load_explore.py` | `d/B_g70.pkl` (cache) |
| B2 | `d/B_g70.pkl` | `research/scripts/B_02_core_aggregates.py` | `d/B_g70_core.json` |
| B3 | `d/B_g70.pkl` | `research/scripts/B_03_themes_quotes.py` | `d/B_g70_themes.json` |
| B4 | `d/B_g70.pkl` | `research/scripts/B_04_features_segments.py` | `d/B_g70_features.json` |
| B5 | `d/B_g70.pkl` | `research/scripts/B_05_diagnostics.py` | `d/B_g70_diag.json` |
| B6 | `d/B_g70.pkl` | `research/scripts/B_06_fixups.py` | `d/B_g70_features2.json` |
| B7 | `d/B_g70_core.json`, `_themes`, `_features`, `_features2`, `_diag` | `research/scripts/B_07_merge_json.py` | `d/B_g70_aggregates.json` |
| C1 | `BMW-Data/F70_feedback_hackathon.xlsx` | `research/scripts/C_01_profile.py` | `d/C_f70.pkl` (cache), `d/C_f70_part1.json` |
| C2 | `d/C_f70.pkl` | `research/scripts/C_02_taxonomy.py` | `d/C_f70_part2.json` |
| C3 | `d/C_f70.pkl`, `d/C_f70_part2.json` | `research/scripts/C_03_quotes.py` | `d/C_f70_quotes.json` |
| C4 | `d/C_f70.pkl` | `research/scripts/C_04_features.py` | `d/C_f70_features.json` |
| C5 | `d/C_f70.pkl` | `research/scripts/C_05_segments.py` | `d/C_f70_segments.json` |
| C6 | `d/C_f70.pkl`, `d/C_f70_features.json` | `research/scripts/C_06_quality.py` | `d/C_f70_quality.json`, `d/C_f70_features_byc.json` |
| C7 | `d/C_f70_part1/part2/quotes/features/features_byc/segments/quality.json` | `research/scripts/C_07_merge.py` | `d/C_f70_aggregates.json` |
| D1 | `BMW-Data/G60_…xlsx`, `G70_…xlsx`, `F70_feedback_hackathon.xlsx` | `research/scripts/D1_load_profile.py` | `d/D_rows.pkl` (cache), `d/D1_profile.json` |
| D2 | `d/D_rows.pkl` | `research/scripts/D2_dup_taxonomy.py` | `d/D2_dup_taxonomy.json`, `d/D_norm.pkl` (cache) |
| D3 | `d/D_rows.pkl` | `research/scripts/D3_sources_lang_coverage.py` | `d/D3_sources_lang.json` |
| D4 | `d/D_rows.pkl` | `research/scripts/D4_residual_checks.py` | `d/D4_residual.json` |
| D5 | `d/D_rows.pkl` | `research/scripts/D5_examples.py` | none (prints only) |
| D6 | `d/D1_profile.json`, `D2_dup_taxonomy`, `D3_sources_lang`, `D4_residual` | `research/scripts/D6_audit_merge.py` | `d/D_audit.json` |
| E1 | `BMW-Data/F70_G60_G68_G70_customer_studies.xlsx` | `research/scripts/E_01_dump_structure.py` | `d/E_raw_dump.txt`, `d/E_formulas.txt` |
| E2 | same workbook | `research/scripts/E_02_structure.py` | `d/E_structure_report.json` |
| E3 | same workbook | `research/scripts/E_03_extract.py` | `d/E_studies_long.csv`, `d/E_studies.json` |
| F1 | `BMW-Data/F70_OptionList.PDF`, `G60_…PDF`, `G70_…PDF` | `research/scripts/F_dump_raw.py` | `d/F_raw_F70.txt`, `F_raw_G60.txt`, `F_raw_G70.txt`, `d/F_pagemap_raw.json` |
| F2 | `BMW-Data/F70_OptionList.PDF` | `research/scripts/F_probe_matrix.py` | none (probe) |
| F3 | `d/F_raw_F70.txt` | `research/scripts/F_show_pages.py` | none (probe) |
| F4 | `BMW-Data/F70_OptionList.PDF` | `research/scripts/F_extract_options.py` | **FAILS** (TypeError, never worked; superseded by F6) |
| F5 | (none) | `research/scripts/F_probe_rows.py` | **FAILS** (IndexError; needs args; abandoned probe) |
| F6 | `BMW-Data/F70_OptionList.PDF`, `G60_…PDF`, `G70_…PDF` | `research/scripts/F_parse_pricelists.py` (parent agent) | `d/F_items.json`, `d/F_options.csv`, `d/F_variants.json`, `d/F_packages.json`, `d/F_parse_log.json` |
| F7 | `d/F_items.json`, `d/F_variants.json` | `research/scripts/F_check_visual.py` | none (42/42 visual checks pass) |
| F8 | `d/F_items.json` | `research/scripts/F_summary.py` | `d/F_focus_features.json`, `d/F_focus_features.md` |
| Z1 | every script above | `research/scripts/Z_trace_io.py` | `d/Z_io_trace.json` (this table's source) |

(1) `d/A_g60_feedback_explorer.csv` was exported from `BMW-Data/G60_feedback_hackathon.xlsx` by inline
code, not a saved script. Verified: identical to the workbook, 60,060 / 60,060 cells.

## B. Files NOT produced by any saved script (inline code in subagent sessions)

| File | Made by | Status |
|---|---|---|
| `d/A_g60_feedback_explorer.csv` | A, inline export of G60 xlsx | verified identical to source |
| `d/E_cneu_table.txt` | E, inline | display table only; values match `E_studies.json` |
| `d/G_nhtsa_recalls.json`, `d/G_nhtsa_complaints.json` | G, inline calls to api.nhtsa.gov | raw API responses, partial (G was killed) |
| `d/G_search_batch1.json` | G, inline web searches | raw search results, never analysed |
| `d/G_t.json`, `d/G_nhtsa_tmp.json` | G, inline API probes | 66-byte scratch, ignore |
| `d/D2_err.txt` (empty), `d/D3_err.txt` | D, stderr capture | pandas warnings only, no errors |

## C. Reproducibility check

Re-running all scripts reproduced every headline number. Only 5 files differed, all cosmetic:
`C_f70_aggregates/segments.json` (top-N country tie-breaks between equal counts),
`D2_dup_taxonomy.json` / `D_audit.json` (randomly chosen example IDs from a set), `A_g60_aggregates.json`
(key order only, 0 value differences). Committed versions were restored so reports and data match.

## D. Inputs never used by any research script

- `BMW-Data/sales_volumes.xlsx`: read only by the parent agent in ad-hoc checks (no saved script).
- `BMW-Data/PM_Interview.rtf`: read by the parent agent (converted with macOS `textutil`), no script.
