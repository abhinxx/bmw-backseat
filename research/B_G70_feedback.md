# B — G70 (BMW 7 Series) Customer Feedback: Evidence Report

**Source:** `BMW-Data/G70_feedback_hackathon.xlsx`, sheet `Feedback_Explorer`.
**Scripts (all actually run, project venv):** `research/scripts/B_01_load_explore.py` … `B_07_merge_json.py`.
**Machine-readable aggregates:** `research/data/B_g70_aggregates.json` (merges `B_g70_core.json`, `B_g70_themes.json`, `B_g70_features.json`, `B_g70_features2.json`, `B_g70_diag.json`).
**Tag legend:** [OBSERVED] raw fact · [COMPUTED] script metric · [INFERRED] interpretation · [OPEN] unknown.

**Critical definitional fact** [OBSERVED]: the `Feedback Type` column has **no literal "Dislikes"** value. Values are: `Likes`, `Difficult to Use`, `Defect`, `Wants`, `(None)`. Throughout this report **"negative" = {Difficult to Use, Defect}**; `Wants` (unmet demand) and `(None)` are reported separately and never silently merged.

---

## 1. Rows vs unique IDs vs unique texts; multi-category duplication [COMPUTED: B_02]

| Measure | Value |
|---|---|
| Rows | **4,690** |
| Unique IDs | **4,000** |
| Unique feedback texts | **3,993** |
| IDs in exactly 1 row | 3,738 |
| IDs in >1 row | 262 (max 17 rows for one ID; mean 1.173 rows/ID) |
| Texts shared by >1 ID | 6 (near-duplicate boilerplate, e.g. "Customer stated the vehicle is very comfortable." on 2 IDs) |

Per-ID attributes are internally consistent: each ID has exactly one Country, one Source, one Engine Type [COMPUTED — verified `nunique()==1` per ID].

**How duplication works — two concrete examples** [OBSERVED]:

- **G70-0007** — one comment ("there are software glitches in idrive 8. hopefully you will give your customers an upgrade to 8.5.") appears in **2 rows**: row 1 tagged `Defect` / `ConnectedDrive and Infotainment, overall technology` / `Malfunction`; row 2 tagged `(no Feedback Type)` / `no_class_found`. Same text, two taxonomy outcomes.
- **G70-0008** — the long i7 praise comment appears in 2 rows: row 1 `Likes` / `Remote controlled parking` / `Like: usability`; row 2 `(no Feedback Type)` / `no_class_found`.

I.e. multi-row IDs = one comment mapped to several categories, **plus** an `no_class_found` fallback row that adds nothing. Any row-level count double-counts customers; this report counts **unique IDs** everywhere unless stated.

## 2. Distributions [COMPUTED: B_02]

**Source** (rows / unique IDs): Source B 2,855/2,853 · Source A 1,383/**695** · Source C 314/314 · Source D 138/138. Source A averages **2.0 rows per ID** (double-coded); B/C/D ≈ 1.0.
**Country** (unique IDs): US **3,792 (94.8%)** · KR 137 · JP 40 · GB 8 · CA 8 · FR 3 · DK/FI/SE/ZA/AU 1–2 each · NO 1 · ES 1.
**Engine Type** (unique IDs): ICE **2,568** · BEVE (BEV) **1,129** · PHEV **303**.
**Feedback Type** (unique IDs): Likes 1,786 · Difficult to Use 1,066 · (None) 682 · Wants 487 · Defect 396. (IDs can hold multiple types across rows.)

**Source × Country** (unique IDs) [OBSERVED]: Sources B/C/D are **100% US**. All non-US data comes from Source A: A-US 487, A-KR 137, A-JP 40, A-CA 8, A-GB 8, remainder ≤3 each. → **Regional comparison is confounded with source**: any US-vs-rest difference may be a data-collection artifact, not a market difference. [INFERRED]

**Country × Engine** (unique IDs, top cells): US ICE 2,435 · US BEVE 1,075 · US PHEV 282 · KR ICE 98 · KR BEVE 29 · KR PHEV 10 · JP ICE 30 · JP BEVE 10. All other cells ≤6. [OBSERVED]

## 3. Taxonomy: top 25 level-2 categories, unclassified rate [COMPUTED: B_02]

Unclassified: 200 rows have missing `Vfc level2 Name`; 470 rows are `no_class_found`. **440 IDs have *only* unclassified rows (11.0%); 670 IDs (16.8%) have at least one unclassified row.** [COMPUTED]

Top level-2 by unique IDs (Likes = Likes rows; Neg = Difficult-to-Use+Defect; W = Wants; `None` = untagged rows on that ID):

| # | level2 | uIDs | Likes | Neg | W | other/None |
|---|---|---|---|---|---|---|
| 1 | no_class_found | 470 | 0 | 0 | 0 | 470 |
| 2 | Drivetrain | 349 | 300 | 44 | 4 | 2 |
| 3 | Handling / Riding | 248 | 232 | 10 | 7 | 1 |
| 4 | (missing) | 200 | 0 | 0 | 0 | 200 |
| 5 | Exterior design | 178 | 161 | 0 | 17 | 0 |
| 6 | Body equipment, overall technology | 173 | 104 | 52 | 15 | 2 |
| 7 | Interior design | 111 | 97 | 0 | 14 | 0 |
| 8 | Seats | 99 | 62 | 31 | 8 | 2 |
| 9 | Drive, driving dynamics and chassis, overall technology | 91 | 90 | 0 | 0 | 1 |
| 10 | Interior comfort | 71 | 70 | 0 | 1 | 0 |

(full top-25 in `B_g70_core.json → top25_level2`; columns = distinct IDs per Feedback Type within the category). Full top-25 includes ConnectedDrive and Infotainment, Touch screen/operation, Personal eSIM, My BMW App, Apple CarPlay, Automatic doors, Electric Range, Rear seat entertainment, Ambient light — digital/controls categories recur heavily on the negative side. [OBSERVED]

## 4. Top dislike & like themes — overall and US vs next-largest country (KR) [COMPUTED: B_03]

**Top 15 negative themes overall** (uIDs; kind split in `B_g70_themes.json`): Body equipment/overall technology 52 (all Difficult-to-Use) · Drivetrain 43 (22 DtU / 22 Defect) · Vehicle climatization 38 · Exterior 37 (28 Defect) · Personal eSIM 36 · ConnectedDrive & Infotainment 36 · Operating concept/OS 33 (all DtU) · Seats 31 · Touch screen/operation 30 · My BMW App 26 · Apple CarPlay 24 · Automatic doors 24 · General enquiry 24 · Electric Range 22 · Braking 21.
→ **[INFERRED] The G70 complaint profile is dominated by digital usability (eSIM, app, iDrive, touchscreen, CarPlay ≈ 6+ of the top 10 categories), not powertrain or comfort.**

**Top 15 like themes overall**: Drivetrain 300 · Handling/Riding 232 · Exterior design 161 · Body equipment 104 · Interior design 97 · Drive/dynamics 90 · Interior comfort 70 · Seats 62 · Space 38 · Ambient light 33 · Automatic doors 33 · Cushioning/damping 30 · My Modes 29 · ConnectedDrive 27 · Touch screen 26.

**Top-10 "Wants" themes** (unmet demand — a distinct signal): Wheels/tires 19 · Exterior design 17 · Body equipment 15 · Interior design 14 · Panorama glass roof 14 · Start-stop (MSA) off-option 13 · Electric Range 13 · My Modes 11 · Interior rearview mirror 11 · Door open/close 9 (also: Seat massage 9, Seating ventilate/heat 8). [OBSERVED]

**US vs next-largest country (KR, 137 uIDs):**
- KR **negative** themes: max theme size is **5** (Drivetrain). **n<30 → insufficient evidence** for KR dislike differences. [COMPUTED: `KR_neg_theme_max`=5]
- KR **like** themes: Drivetrain 33 (the only cell ≥30) · Handling/Riding 16 · Drive/dynamics 7. US like themes: Drivetrain 260 · Handling 208 · Exterior design 157 · Body equipment 101. [OBSERVED]
- JP (40 uIDs): max theme 7 → insufficient. [COMPUTED]
→ **[OPEN] US-vs-China regional differences cannot be examined at all: China (CN) does not appear in this workbook (13 countries, none CN).** US-vs-KR comparison is additionally confounded by Source (only Source A carries KR). [INFERRED]

## 5. Verbatim quotes, top-10 negative categories [OBSERVED: B_03; all texts <200 chars, no truncation needed]

| Category | ID | Country/Engine/Type | Quote |
|---|---|---|---|
| Body equipment, overall tech | G70-1510 | US/BEVE/DtU | "Customer stated the vehicle required some time to figure out." |
| Body equipment, overall tech | G70-0381 | US/ICE/DtU | "Customer stated they are still trying to lern all of the technology." |
| Drivetrain | G70-1035 | KR/BEVE/DtU | "fast charging on this car is extremely slow" |
| Drivetrain | G70-3393 | KR/PHEV/DtU | "performance-wise it does the job, but the price is quite high." |
| Vehicle, climatization | G70-2819 | US/ICE/DtU | "the car's air conditioner system is quite bad." |
| Vehicle, climatization | G70-1166 | US/ICE/DtU | "Customer stated that with the new design of the vents they do not deliver enough airflow." |
| Exterior | G70-2930 | US/PHEV/DtU | "Customer stated that the vehicle feels a bit on the large side." |
| Exterior | G70-0328 | US/ICE/DtU | "Customer remarked the exterior feels overly large and bulky when compared with her 2019 750i." |
| Personal eSIM | G70-2544 | US/BEVE/DtU | "Customer says the process of setting up the eSIM was a nightmare." |
| Personal eSIM | G70-1778 | US/BEVE/Defect | "i've got a problem with my esim and nobody's really helping me sort it out" |
| ConnectedDrive & Infotainment | G70-2613 | KR/BEVE/DtU | "system operation is a bit inconvenient and has some errors" |
| ConnectedDrive & Infotainment | G70-0770 | US/PHEV/DtU | "like the car, but there really should be videos showing how to work all the features." |
| Operating concept / OS | G70-1461 | US/ICE/DtU | "Customer commented that the iDrive system requires some time to get used to and learn." |
| Operating concept / OS | G70-1822 | US/BEVE/DtU | "Customer stated he does not use the vehicle on a daily basis and finds the user interface to be not very intuitive." |
| Seats | G70-0885 | US/ICE/DtU | "Customer observed the white leather seats are extremely delicate and quickly show dirt when they are touched." |
| Seats | G70-1802 | US/ICE/DtU | "Customer stated the seats feel quite firm and that changing the seat adjustments does not make them any more comfortable." |
| Touch screen, operation | G70-3477 | US/BEVE/DtU | "Customer indicated that the touch screen is difficult for them to use while driving." |
| Touch screen, operation | G70-0232 | US/ICE/DtU | "I had a problem with Touchscreen/display screen - DTU: 'I do not like it compared to the 2020 version'" |
| My BMW App | G70-2468 | US/ICE/DtU | "Customer stated logging into the my BMW app is not easy for him." |
| My BMW App | G70-2394 | US/BEVE/Defect | "Customer stated the my BMW app runs very slowly and frequently times out when sending requests." |

## 6. Feature-level signals (taxonomy AND keyword, counted separately) [COMPUTED: B_04, B_06]

Format: unique IDs (Likes / negative / Wants). Keyword = regex on feedback text; Taxonomy = level2/level3/combined-label match; union dedupes IDs matching either. Almost everything is US-only (non-US cells shown in JSON, nearly all ≤2).

| Feature | Keyword uIDs (L/N/W) | Taxonomy uIDs (L/N) | Union uIDs |
|---|---|---|---|
| **Rear-seat experience** (rear seat, theatre screen, chauffeur, rear entertainment) | **100 (41/46/25)** | 41 (17/17) — all "Rear seat entertainment" | 113 |
| — "theatre/theater screen" only | 47 (11/25/13) | — | — |
| — "executive lounge" | **0** | 0 | 0 |
| — "chauffeur/driver" | **1** | — | 1 |
| **Seat heating/ventilation** | 24 (7/15/7) | 0 via level2-name match; via combined label "Seating, ventilate / heat": **27 (5/15/8)** | 27* |
| Steering wheel heating | 10 (2/5/3) | 7 (2/4) | 10 |
| **Exterior colours/paint** | 92 (49/32/14) | **0** (no colour/paint label exists in this taxonomy slice) | 92 |
| **Performance/power (keyword)** | 259 (109/118/38) | — | — |
| Performance/drivetrain (taxonomy, broad incl. Handling/Drivetrain) | — | 799 (629/128) | 946 |
| **Digital/iDrive/infotainment/controls** | **553 (94/400/84)** | 354 (107/221) | 701 |
| **Driver assistance** | 289 (78/178/65) | 258 (93/129) | 384 |
| Range/charging | 288 (95/158/53) | 187 (53/101) | 316 |
| Comfort general | 506 (326/132/44) | 486 (374/104) | 763 |

\*keyword and taxonomy sets for seat heat overlap; 27 taxonomy uIDs, all US.

Readings:
- **Digital controls is the single largest friction area**: 553 uIDs mention it by keyword, of which 400 carry a negative row — the negative/like ratio (400/94) is the worst of any feature. [COMPUTED → INFERRED: priority candidate]
- **Performance is a strength on the taxonomy view** (629 likes vs 128 negative) but the raw-keyword view is ambivalent (109/118) because words like "fast/slow" also catch charging-speed complaints (e.g. G70-1035). Report both, don't blend. [INFERRED]
- **7 Series "chauffeur" narrative is NOT in the evidence**: "executive lounge" = 0 mentions, "chauffeur/driver-for-me" = 1. The real rear-seat story is **owner-operated Theatre Screen + rear-seat entertainment** (100–113 uIDs, negative-leaning 46/41 DtU+Defect), and most negatives actually tag to **Personal eSIM / connectivity setup**, not the screen itself (e.g. G70-1936, G70-2342, G70-2904 — Fire TV blocked by eSIM/Verizon activation failures). [COMPUTED + OBSERVED → INFERRED: for the PM brief, "rear-seat experience" pain = connectivity onboarding, not hardware comfort]
- Country split is honest but thin: rear-seat keyword 96 US / 2 JP / 2 KR; digital keyword 545 US / 5 KR; assistance 287 US / 1 KR / 1 GB. [COMPUTED]

## 7. Candidate behavioural segments [COMPUTED: B_04 method; interpretation marked]

Method: per-ID flags from keyword∪taxonomy matches, sentiment from that ID's own Feedback Types. Sizes in unique IDs of 4,000.

1. **Theatre-screen / rear-seat-engaged** — 113 uIDs (2.8%). 41 Likes-bearing, 46 negative-bearing, 25 Wants. [INFERRED] Rear screens are used by owners themselves (streaming/Fire TV), not by chauffeured passengers.
2. **Controls-frustrated digital users** — 221 uIDs (5.5%) with ≥1 negative row in infotainment/iDrive/app/eSIM taxonomy (A 46 / B 147 / C 28). Only **19** of the 221 have any Likes row at all; the other 202 have none — **but** that split is partly a source artifact: Source C rows never carry Likes by construction, and most Source B complaint tickets contain only the complaint. So "frustrated and otherwise silent" is the modal record shape here; we cannot tell whether these customers are also satisfied elsewhere. [COMPUTED; interpretation capped by source structure]
3. **App/digital-ecosystem engaged** (app, CarPlay, eSIM, remote, My BMW; any sentiment) — 226 uIDs (5.7%); 107 of them are also in #2 (computed) — engagement and friction co-occur; a *dependency* group, not a satisfaction one. [COMPUTED/INFERRED]
4. **BEV range/charging-conscious** — 158 uIDs with negative range/charging text (subset of 1,129 BEVE owners, ≈14%). [COMPUTED]

**Honesty limits:** these are *topic-and-sentiment clusters in one US-dominated feedback corpus*, not validated market segments; no purchase funnel, ownership tenure, trim/option data, and **no demographics exist in the data (age, gender, income, household: not in data)** — never invent them. Cross-country segment sizing (KR: rear-seat 2, controls-frustrated 4, app-engaged 1) is far too small to claim regional segment differences. If the dashboard needs segments, present these four as "evidence-backed concern groups" with sizes and quotes, **not** as personas with names and faces. [INFERRED]

## 8. Data quality issues & caveats [COMPUTED/OBSERVED unless noted]

1. **No "Dislikes" value exists** despite the brief's schema note — negatives are `Difficult to Use` (1,066 uIDs) + `Defect` (396). A dashboard filtering on "Dislikes" returns zero. [OBSERVED]
2. **Multi-row IDs** (262 IDs, max 17 rows) inflate row-level counts; 470 `no_class_found` + 200 missing-label rows are mostly duplicate echoes of an already-classified row. **16.8% of IDs touch unclassified rows; 11.0% are classifiable only as unknown.** [COMPUTED]
3. **Source/region confound**: B/C/D are US-only; all international data (KR 137, JP 40…) comes from Source A, which is also double-coded (2 rows/ID) and holds 470 unclassified IDs. Source C is 100% negative-type rows (181 DtU + 59 Defect of 314) and Source D is 100% `(None)`-labelled (138 uIDs) — sources have wildly different sentiment mixes, so **pooled sentiment shares are source-mix artifacts**. [COMPUTED → INFERRED]
4. **Country coverage**: 94.8% US. **No China.** ES has 9 rows for 1 ID; GB 22 rows/8 IDs. Any per-country bar chart outside US/KR/JP is noise. [COMPUTED]
5. **Narration bias**: many rows are third-party call-desk paraphrases ("Customer stated…"), i.e. curated summaries, not raw voice-of-customer; the 5 boilerplate texts repeated across IDs confirm template processing. Sentiment is partly the agent's, not the customer's. [OBSERVED → INFERRED]
6. **6 near-duplicate texts across different IDs**; 0 exact duplicate (ID+category+type) rows. Text lengths 17–4,260 chars (median 166) — fine; effectively no non-Latin-script text (1 KR ID), so language is not a barrier. [COMPUTED]
7. **Label quirks**: engine label is `BEVE` (not BEV/EV); `Brand`, `Sales Description`, `Derivate` are single-valued ([BMW] / [BMW 7 Series] / G70) → no trim-level (i7 vs 760e etc.) analysis possible; taxonomy has no "exterior colour/paint" node (paint opinions only reachable by keyword); `General enquiry: customer feedback` (24 "negative" uIDs) is a catch-all, not a feature. [OBSERVED]
8. **Wants ≠ complaints**: 487 uIDs express requests (top: wheels/tires, panorama roof, range); keep as a separate opportunity lane in the dashboard. [INFERRED]

---
*All numbers reproducible by running B_01→B_07 from the project root with `.venv/bin/python`. Quotes verified verbatim against cells; none needed 200-char truncation.*
