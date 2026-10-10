EHL HACKATHON - BMW PRODUCT INTELLIGENCE CONSOLE - HANDOVER README
====================================================================
Project root: /Users/abhinavsingh/Documents/codes/ehl-hackathon   (git repo, last research commit 976522a)
Product brief: /Users/abhinavsingh/Downloads/BMW_Product_Vision_PRD_Brief.md
Python env:    .venv/bin/python  (openpyxl, pandas, pypdf, pdfplumber)

Only usable files are listed below. Everything else in research/ is intermediate output and can be ignored.


1. RAW INPUT DATA  (BMW-Data/, read-only, not in git)
-----------------------------------------------------
BMW-Data/G60_feedback_hackathon.xlsx    5 Series customer comments   5,005 rows = 4,000 unique comments
BMW-Data/G70_feedback_hackathon.xlsx    7 Series customer comments   4,690 rows = 4,000 unique comments
BMW-Data/F70_feedback_hackathon.xlsx    1 Series customer comments   4,076 rows = 2,128 unique comments
BMW-Data/F70_G60_G68_G70_customer_studies.xlsx   survey scores: US (G60, G70), China (G68, G70), EU (F70, G60, G70)
BMW-Data/sales_volumes.xlsx             sales per market EU/CN/US/RoW, 2024, 2025, 2030 (2030 = forecast)
BMW-Data/F70_OptionList.PDF, G60_OptionList.PDF, G70_OptionList.PDF   BMW Germany price lists, July 2026
BMW-Data/PM_Interview.rtf               BMW product-manager interview
BMW-Data/BMW-Group-Report-2025-en.pdf   added by someone else later; NOT read or used by this work

NOTE: one feedback comment repeats on several rows (one row per category). Count unique IDs, never rows.


2. RESHAPED / EXTRACTED DATA, READY TO USE  (same values as the originals, nothing corrected or removed;
   only put into a form a program can filter. Replaces the raw files named.)
-------------------------------------------------------------------------------------------------------
research/data/E_studies_long.csv     RESHAPED: ALL survey scores, one row per (sheet, market, model, attribute, metric),
                                     each value with its source cell. Replaces the customer_studies.xlsx.
                                     Checked: 185 values by the parent agent + 40 by the E subagent, 0 mismatches.
research/data/F_items.json           EXTRACTED from PDF: ALL equipment items of the 3 price lists (431 items): standard/optional per
                                     engine variant, option code, price EUR, conditions, page number.
                                     Replaces the 3 option-list PDFs (equipment pages).
research/data/F_options.csv          same as F_items.json flattened, one row per (item, variant) - for spreadsheets
research/data/F_variants.json        23 engine variants: fuel, kW/PS, base price EUR
research/data/F_packages.json        M Sport packages and M-model pages: price lines and contents
                                     F_* checked: 42/42 values vs rendered PDF pages, 23/23 variants vs raw text.

NOT YET CLEANED OR RESHAPED: the 3 feedback .xlsx files (the main data). They still have repeated rows,
blank feedback types and broken labels. No usable file exists for them yet.
Next step for whoever continues: build one file with the 10,128 unique comments (one record per comment,
labels as a list) using the schema in research/D_feedback_audit.md section 9, then verify it by rebuilding
all 13,771 original rows and comparing cell by cell.


3. SUMMARIES  (pre-computed numbers for dashboard charts and for checking the app's own counts)
----------------------------------------------------------------------------------------------
research/data/A_g60_aggregates.json   G60: counts by country/engine/source, top themes, quotes with IDs,
                                      feature mentions, behavioural groups
research/data/B_g70_aggregates.json   G70: same
research/data/C_f70_aggregates.json   F70: same
research/data/D_audit.json            data-quality results + which comparisons are safe / unsafe
research/data/F_focus_features.json   per-model status of key features (seat heating, rear comfort, HUD,
                                      assistance, audio...) with page and option-code references


4. REPORTS  (read these to understand the data)
-----------------------------------------------
research/A_G60_feedback.md       5 Series feedback findings
research/B_G70_feedback.md       7 Series feedback findings
research/C_F70_feedback.md       1 Series feedback findings
research/D_feedback_audit.md     data quality, duplication rules, SAFE vs UNSAFE comparisons, ingestion schema (sec. 9)
research/E_customer_studies.md   survey structure and findings
research/F_option_lists.md       price-list findings and caveats
research/PROVENANCE.md           which input file -> which script -> which output


5. PYTHON SCRIPTS  (only these 4 remain; all were re-run after cleanup and still pass)
-------------------------------------------------------------------------------------
research/scripts/E_03_extract.py         regenerates E_studies_long.csv from the survey workbook
research/scripts/F_parse_pricelists.py   regenerates F_items/F_options/F_variants/F_packages from the PDFs
research/scripts/F_check_visual.py       verifies the price-list output (must print 42/42 passed)
research/scripts/F_summary.py            regenerates F_focus_features.json from F_items.json
Run from project root:  .venv/bin/python research/scripts/<name>.py
The other 30 scripts (which produced the section 3 summaries and section 4 reports) were deleted from the
folder. They are still in git: restore with  git checkout 659d82e -- research/scripts/


6. KEY FACTS  (verified against the raw files)
----------------------------------------------
- No demographics exist (no age, gender, income, family). Only country, engine type, anonymised source A-D.
  Personas can only be behavioural (e.g. "frustrated by controls", "driving-dynamics fans").
- Countries in feedback (unique comments):
    G60: US 3,610 | Korea 205 | Japan 53 | UK 36 | other Europe 75 | CA/AU 21
    G70: US 3,792 | Korea 137 | Japan 40 | UK 8 | other Europe 11 | CA/AU/ZA 12
    F70: UK 1,293 | Japan 672 | Sweden 71 | France 53 | other 39 | US 0
  No China and no Germany in feedback. All non-US feedback comes from Source A only.
- China only in the survey (no sample sizes, unstated scale) and in sales.
- Sales 2025: Europe is the largest market (G60/G68 115k EU vs 78k US vs 75k CN; G70 13k vs 12k vs 10k;
  F70 85k EU, 0 US/CN), but G60/G70 feedback is ~92% US.
- #1 complaint theme (G60, G70): digital controls (iDrive, touchscreen, CarPlay, eSIM, My BMW App).
  The US survey confirms it independently (G70 "intuitiveness of controls" top-2-box 24.9% vs G60 42.2%).
- Best demo case: rear seat heating is standard on G70 but a EUR 2,750 Comfort Paket option on G60
  (price list p17, code 7VB); G70 wins US survey 2nd-row comfort (73.6% vs 47.1% top-2-box).
- Caveats: price lists are German and July 2026 (G70 has Panoramic iDrive / OS X, newer than the cars in
  the feedback); survey CN/EU means have 12-15 decimals and US blocks sum to exactly 100% (possibly
  generated data); feedback has no dates.


7. NOT DONE
-----------
- Clean feedback file (see section 2).
- External research (competitors, Reddit, press): only raw NHTSA recall/complaint pulls exist
  (research/data/G_nhtsa_recalls.json, G_nhtsa_complaints.json). Files G_batch1_index.json,
  G_search_batch2/3/4.json and F_analysis_diffs.json were written by another agent, not part of this work.
- No application code.


8. ENVIRONMENT CHANGES MADE DURING THIS WORK  (Hermes config, outside this folder)
---------------------------------------------------------------------------------
- delegation.provider=atira, delegation.model=qwen3.8-flash-next (subagents default to Qwen)
- providers.atira.stale_timeout_seconds=120
- Hook ~/.hermes/agent-hooks/subagent_watchdog_gate.py blocks delegate_task spawns unless
  ~/.hermes/agent-hooks/subagent_watchdog.py --loop is running. Disable: touch ~/.hermes/agent-hooks-state/watchdog-gate-off
