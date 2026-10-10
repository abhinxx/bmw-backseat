# D — Cross-file data-quality & comparability audit (G60 / G70 / F70 feedback workbooks)

Scope: `BMW-Data/{G60,G70,F70}_feedback_hackathon.xlsx`, sheet `Feedback_Explorer`, same 12 columns in all three files [OBSERVED].
Scripts (all actually run, project `.venv`): `research/scripts/D1_load_profile.py`, `D2_dup_taxonomy.py`, `D3_sources_lang_coverage.py`, `D4_residual_checks.py`, `D5_examples.py`, `D6_audit_merge.py`. Machine-readable outputs: `research/data/D1_profile.json`, `D2_dup_taxonomy.json`, `D3_sources_lang.json`, `D4_residual.json`, merged into **`research/data/D_audit.json`**.
Every figure below comes from those files. Rows ≠ customers: counts are given as rows and unique IDs throughout. Dedup rule used for comment-level stats: first row per (Model, ID) — verified safe because no ID ever varies in Source/Country/EngineType [COMPUTED, D4].

## 1. Per-file profile

| | G60 | G70 | F70 |
|---|---|---|---|
| Rows | 5 005 | 4 690 | 4 076 |
| Unique IDs | 4 000 | 4 000 | 2 128 |
| Unique raw texts | 4 000 | 3 993 | 2 128 |
| Unique normalised texts | 3 998 | 3 993 | 2 127 |

[COMPUTED, D1/D2] IDs are `MODEL-NNNN`, contiguous 1..max with zero gaps in all three files (G60 1–4000, G70 1–4000, F70 1–2128) [COMPUTED, D4]. Note: F70's real comment universe is **2 128, half of G60/G70's 4 000** — its 4 076 rows are inflation from label multiplicity, not more data.

Null rate per column (fraction of rows) [COMPUTED, D1]:

| Column | G60 | G70 | F70 |
|---|---|---|---|
| ID, Source, Brand, Sales Description, Country, Derivate, Engine Type, Customer Feedback | 0.0 | 0.0 | 0.0 |
| Feedback Type | 0.146 (731) | 0.145 (682) | 0.267 (1 087) |
| Vfc level2 3 Name / level2 Name | 0.040 (200 each) | 0.040 (200 each) | 0.0 |
| Vfc level3 Name | 0.145 (725) | 0.143 (670) | 0.267 (1 087) |

Nulls are structured, not random [OBSERVED, D4]: every `Vfc level2` null (200/file in G60/G70) is exactly a row where Feedback Type is also null (Source C 64/62 + all Source D 136/138); Source D has Feedback Type null in 100% of its rows. In F70, Feedback-Type nulls (1 087 rows) coincide exactly with level3 nulls and are tagged `no_class_found` at level2 (1 087 rows; G60 525, G70 470).

Distinct categorical values [COMPUTED, D1]:
- **Brand**: 1 value everywhere (`[BMW]`). **Derivate**: 1 (`G60`/`G70`/`F70`). **Sales Description**: 1 each (`[BMW 5 Series]`, `[BMW 7 Series]`, `[BMW 1 Series]`) — [OPEN] F70 = "1 Series" label with e-code F70 (usually 5 Series) is a labelling oddity worth confirming with the data owner.
- **Source**: G60 {B 2627, A 1858, C 384, D 136}; G70 {B 2855, A 1383, C 314, D 138}; F70 {A only, 4076}.
- **Engine Type**: G60 {ICE 2768, BEVE 1763, PHEV 474}; G70 {ICE 2956, BEVE 1347, PHEV 387}; **F70 {ICE 4076} — BEVE/PHEV completely absent**.
- **Country** (13/13/9 distinct): G60 US 4365, KR 278, GB 89, JP 76, SE 51, DK 49, CA 41, NO 17, FR 14, FI 14, AU 7, LV 3, ES 1; G70 US 4418, KR 157, JP 56, GB 22, CA 11, ES 9, DK 5, FR 3, AU 2, SE 2, FI 2, ZA 2, NO 1; F70 GB 2790, JP 1026, SE 121, FR 75, AU 30, DK 13, FI 11, KR 5, ZA 5.
- **Feedback Type** (4 values + null): Likes / Difficult to Use / Wants / Defect. Mixes: G60 {Likes 1951, DtU 1306, null 731, Wants 582, Defect 435}; G70 {Likes 1890, DtU 1119, null 682, Wants 518, Defect 481}; F70 {Likes 1630, null 1087, DtU 595, Defect 491, Wants 273}.
- **Vfc level2 Name** distinct: 221 / 211 / 120; **level3**: 82 / 77 / 57; **level2 3**: 953 / 854 / 336 (full lists in `D1_profile.json`; too long to inline).

## 2. Duplication model

Within-file: every multi-row ID carries **identical text** in all its rows (G60: 365/365, G70: 262/262, F70: 1009/1009) [COMPUTED, D2]. Extra rows are a **label list**: e.g. ID G60-0008 has 3 rows, same text, level2 ∈ {Owner's Manual, Space / spatial impression, no_class_found}. Nearly all multi-row IDs disagree across level2 (G60 364/365, G70 262/262, F70 999/1009) — so rows per ID ≈ labels per comment (max 18 in G60, 17 in G70, 11 in F70). **Counting rows overstates multi-labelled topics by up to ~2.4× in F70.** [OBSERVED/COMPUTED]

Exact duplicate texts across different IDs are rare [COMPUTED, D2]: G60 2 texts (4 rows), G70 6 texts (13 rows), F70 1 text (2 rows: F70-0837 & F70-1507 both "really pleasant car to drive", countries GB/FR). Example: G60-1674 and G60-2202 both "customer stated that the vehicle feels comfortable" (both Source B, US, Likes).

Near-duplicates (identical first-8-normalised-words prefix, per unique comment) are the real duplication story [COMPUTED, D2]: G60 116 clusters / 376 comments (9.4% of IDs), G70 100 clusters / 327 (8.2%), F70 only 8 / 16. Cluster heads are survey-prompt echoes, e.g. prefix "what is the primary reason for your nps…" (IDs G60-0128, G60-0327, G60-0332…) and "if there was one comment positive or negative…".

Cross-file exact text overlap [COMPUTED, D2]: F70∩G70 = 0; F70∩G60 = 1 shared comment ("the best car i have ever driven"); G60∩G70 = 13 shared comments, all Source-B style ("customer stated he is pleased with the touchscreen": G60-1435 ↔ G70-1796). [INFERRED] Source B agent notes reuse canned summaries ("customer stated …"), so short generic summaries collide; not evidence of copied customers.

## 3. `Vfc level2 3 Name` = level2 + " : " + level3?

[COMPUTED, D2] Violations: **G60 2/4 280** checked rows, **G70 3/4 020**, **F70 0/2 989**. All 5 violations are the same category name containing a colon: `Cross Traffic Warning Rear with Brake Intervention: Malfunction` written with `": "` not `" : "` (examples G60-1588, G60-2019, G70-0326, G70-0774, G70-2594). Null pattern is perfectly consistent: level2-3 null ⟺ level2 null (0 mismatches); the column equals Feedback-Type-null rows in G60/G70. Treat the combined string as derived; parse it by splitting on `" : "` and special-casing the colon-in-name category.

## 4. Taxonomy comparability

Level2 sets: F70 120, G60 221, G70 211; union 235, common to all three 119 [COMPUTED, D2]. Jaccard: **G60↔G70 = 0.912 (near-identical taxonomy); F70↔G60 = 0.536; F70↔G70 = 0.569**. F70's 120 categories are (per the intersection math) fully contained in G60∪G70 — F70 adds no categories, it simply lacks coverage of ~half the taxonomy (consistent with ICE-only + no Sources B–D). Model-specific categories: G60 15 (e.g. "Bidirectional charging", "Apps (smartphone)", "Opening / closing convertible top / hardtop"), G70 4 ("Airbags", "Child restraint seat", "Dynamic Stability Control (DSC)", "Traffic Jam Assistant"), F70 0. Level3: 82/77/57 distinct, 56 common to all three, union 84 — a small closed set of attribute facets ("function", "usability", "sound", "Range", …). [COMPUTED, D2]

Feedback Type × level3 prefix [COMPUTED, D3; **correction**: D2's original "Positive/Negative" polarity mapping was wrong — Feedback Type values are Likes/Difficult to Use/Wants/Defect, so D2's "contradictions" counts (e.g. 1 472) are an artefact; the corrected crosstab is in `D3_sources_lang.json["ft_prefix_crosstab"]`]:
- `Like:` prefix never contradicts Feedback Type: Like:-rows are 100% "Likes" in all files (F70 1 472, G60 1 514, G70 1 430). Zero mismatches.
- `Dislike:` prefix is tiny (23/18/12 rows) and appears **only** with Feedback Type "Wants" — arguably a contradiction (a "dislike" coded as a want, e.g. F70 rows with L3 "Dislike: …" + FT Wants), 100% of Dislike-rows in each file.
- level3 is otherwise prefix-free: "other" share 1 494/2 748/2 578 rows; the grammar is mixed (`Like:`, `Dislike:`, `Customer request:`, `<no-colon>`, plus rare `Leak:`, `Opening, closing:`) [COMPUTED, D4].
- Likes-rows without `Like:` prefix: 437 (G60), 460 (G70), 158 (F70) — prefix is *sufficient but not necessary*; do not use it as the sentiment flag. Feedback Type is the authoritative sentiment field.

## 5. Source profiles (pooled, per unique comment) [COMPUTED, D3]

| Source | Comments | Median len | "Customer stated/mentioned…" | First-person (I/my/we) | Countries | FT mix | [INFERRED] what it is |
|---|---|---|---|---|---|---|---|
| A | 3 677 | 144 | 0% | 56% | GB 1337, US 951, JP 765, KR 346, SE 101, FR 64 (multi-market) | Likes 1826, null 780, DtU 438, Defect 371, Wants 262 | Direct customer survey free-text (all markets incl. F70) |
| B | 5 479 | 139 | 78% (99.3% start "Customer ") | 2% | **US only** | Likes 2795, DtU 1531, Wants 809, Defect 344; 0 nulls | Call-centre/service-agent notes (3rd-person transcription) |
| C | 698 | 198 | 0% | 90% | **US only** | DtU 434, null 144, Defect 120; 0 Likes, 0 Wants | Structured complaint/issue reports ("I had a (very)(minor/serious) problem with X:" — 82% start "I had a") |
| D | 274 | 113 | 0% | 100% | **US only** | **100% null FT** | One-question survey ("That is the one thing I love most / could be most improved about …" — 77% of texts) |

Sources B/C/D exist **only for G60/G70 and only for the US**; per-model splits are stable (e.g. B agent-transcribed share G60 0.80 / G70 0.76). Example IDs: A=G60-0004, B=G60-0002, C=G60-0001, D=G60-0020 [OBSERVED, D5].

## 6. Language mix (keyword + script heuristic, [COMPUTED, D3]; crude but directional)

All three files are overwhelmingly English: G60 {en 3320, en? 521, other 152, sv 3+, fr 1, ko 0…}, G70 {en 3301, en? 561, other 137, ko 1}, F70 {en 1725, en? 272, other 126, ja/zh 5}. Non-English is essentially absent even in non-UK/US markets: F70 JP (672 comments) is {en 487, en? 121, other 59, ja/zh 5}; F70 SE 71 comments ~all English; G60 KR 205 comments {en 138, en? 40, other 27}. [INFERRED] Feedback is either translated to English before ingestion or the surveys were fielded in English — either way, **do not report "market language" analyses; country ≠ language**.

## 7. Coverage matrix (unique IDs, model × country × Source) [COMPUTED, D3]

Non-zero cells (n≥30 in **bold**):

| Country | F70 | G60 | G70 |
|---|---|---|---|
| US | — (F70 has no US rows at all) | **A 464**, **B 2626**, **C 384**, **D 136** | **A 487**, **B 2853**, **C 314**, **D 138** |
| GB | **A 1293** | A 36 ⚠thin | A 8 ⚠thin |
| JP | **A 672** | A 53 | A 40 |
| KR | A 4 ⚠thin | **A 205** | **A 137** |
| SE | A 71 | A 28 ⚠thin | A 2 ⚠thin |
| FR | A 53 | A 8 ⚠thin | A 3 ⚠thin |
| CA | — | A 18 ⚠thin | A 8 ⚠thin |
| AU | A 16 ⚠thin | A 3 ⚠thin | A 2 ⚠thin |
| DK | A 8 ⚠thin | A 20 ⚠thin | A 2 ⚠thin |
| FI | A 8 ⚠thin | A 9 ⚠thin | A 2 ⚠thin |
| NO | — | A 8 ⚠thin | A 1 ⚠thin |
| ES | — | A 1 ⚠thin | A 1 ⚠thin |
| LV | — | A 1 ⚠thin | — |
| ZA | A 3 ⚠thin | — | A 2 ⚠thin |

⚠ = n<30, too thin for any percentage claim (24 such cells, full list in `D_audit.json → s7_coverage.thin_cells_lt30`; all other model×country×Source cells are structurally 0). Usable non-US cells: F70×{GB 1293, JP 672, SE 71, FR 53}, G60×{US all sources, KR 205, JP 53, GB 36}, G70×{US all sources, KR 137, JP 40}.

## 8. Synthetic-data signals (reported neutrally) [COMPUTED, D3, D4]

Signals present: (1) perfectly contiguous, uniformly formatted IDs in all files (F70-0001…2128, G60-0001…4000, G70-0001…4000, no gaps); (2) heavy templated frames — "Customer stated…" opens 78–80% of Source B; "I had a … problem with" opens 82% of Source C (fixed severity grammar: 85+84+64+50+37 rows for the top 5 variants in G60 alone); Source D is one fixed question, 77% answers end "…about the … of my vehicle" (top trailing-6-word frames: "about the interior of my vehicle" ×30, "the driving feel of my vehicle" ×25); (3) 13 exact texts shared between G60 and G70 (all Source-B canned summaries); (4) near-dupe prefix clusters ~9% in G60/G70. Signals against full synthesis: rich long-tail texts (F70 has only 8 near-dupe clusters and 0 repeated exact texts at all), multi-language quirks (5 Japanese-script texts in F70, Korean/Chinese residue), realistic label multiplicity. [INFERRED] Consistent with real operational text (agent notes, survey exports) that was sampled/renumbered for the hackathon, possibly partially generated for filler rows; cannot be resolved from the data itself. Treat provenance as unverified.

## 9. Recommended ingestion schema & comparison safety

**Schema — one row per unique comment (Model, ID), labels as a list:**
`comment_id (MODEL-NNNN) | model | source (A–D) | brand | sales_description | country | derivate | engine_type | feedback_type (nullable enum) | text_raw | text_norm | is_agent_transcribed (bool, from Source+prefix) | lang (heuristic) | labels: list[{level2, level3, vfc_combined}] (0..n) | has_label (bool) | is_no_class_found (bool)`
Ingestion rules: (a) dedupe (Model, ID)→one comment, aggregate Vfc triples into the label list — never count rows as comments; (b) rebuild `vfc_combined` as `level2 + " : " + level3`, don't trust the sheet column (5 colon violations); (c) map sentiment from **Feedback Type** only (Likes→pos, DtU/Defect→neg, Wants→want, null→unknown); treat `Dislike:` level3 prefix (53 rows, always Wants) as a coding anomaly to review; (d) keep `no_class_found`/null-label rows (F70 1 087 rows, ~27%) as `has_label=false`, never drop silently; (e) drop constant columns (Brand, Derivate, Sales Description = model aliases); (f) flag Sources B/C/D as US-only.

**SAFE comparisons [COMPUTED from the matrices above]:** G60↔G70 on the shared taxonomy (Jaccard 0.912, 119 common level2 cats); any model on its own US data across sources; F70 GB and JP as standalone markets (n≥672); within-Source A multi-country trends restricted to US/GB/JP/KR(F70 excluded)/SE/FR where n≥30; ICE-only G60/G70 vs F70 (F70 is ICE-only) with that filter stated.
**UNSAFE:** F70 vs G60/G70 on ICE-vs-EV contrasts (F70 has zero BEVE/PHEV rows — structurally impossible, not a finding); any category-share comparison F70 vs G60/G70 without restricting to the 119 common level2 cats (F70 covers only 120/235); sentiment shares that mix Source B (agent, 0 nulls, Likes-heavy) with Source A (56% first-person, 21% null FT) — coding pipeline differs; percentages in the 24 thin cells (n<30) or any non-US Source B/C/D cell (n=0); "customers per country" claims that count rows instead of IDs (F70 rows inflate F70 by 1.92×); language claims by country (§6); Source D shares of any labelled topic (FT is 100% null there).

**Caveats / not done:** language mix is a keyword heuristic (no langdetect in the venv; ~13% "en?" low-confidence); the Source-type labels ([INFERRED] column) are unconfirmed hypotheses; Sales-Description-vs-e-code mismatch on F70 and the provenance question (§8) need the data owner. [OPEN]
