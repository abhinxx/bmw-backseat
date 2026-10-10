# Report A — G60 (BMW 5 Series) Customer Feedback Analysis

**Source:** `BMW-Data/G60_feedback_hackathon.xlsx`, sheet `Feedback_Explorer` (read-only).
**Scripts:** `research/scripts/A_explore.py`, `research/scripts/A_aggregate.py` — every number below is reproduced by `A_aggregate.py` into `research/data/A_g60_aggregates.json`. CSV snapshot: `research/data/A_g60_feedback_explorer.csv`.
**Tags:** [OBSERVED] raw fact · [COMPUTED] script metric · [INFERRED] interpretation · [OPEN] unknown.
**Definitions used throughout:** *row* = spreadsheet row (comment × category pair); *ID* = unique comment/customer record (`G60-xxxx`). Sentiment mapping: Likes→like, Difficult to Use + Defect→dislike, Wants→want, blank→unlabeled.

---

## 1. Rows vs IDs vs texts; multi-category duplication [COMPUTED]

- Rows: **5005**. Unique IDs: **4000**. Unique feedback texts: **4000** — one text per ID, zero texts shared across IDs, zero IDs spanning multiple sources/countries/engines. An ID is a 1:1 comment/owner record; rows are its category annotations.
- Duplication: one comment gets one row per classified aspect. Row-count per ID: 3635 IDs have 1 row; 365 IDs have 2–18 rows (2→145, 3→58, 4→61, 5→37, 6→27, 7→14, 8→11, 9→7, 10→2, 11→1, 17→1, 18→1). Max 16 distinct categories on one ID.
- **Example G60-2467 (US, BEVE, 18 rows):** long multi-topic review annotated across Likes ("Handling/Riding: Like: function", "Seats: Likes comfort", "Exterior design: Look/design appeals"), Dislikes ("Cushioning/damping vehicle: Malfunction", "Steering wheel: Not user-friendly"), Wants ("Apple CarPlay: Customer request: function"), Defect, and one `no_class_found` row. Text begins: "great: * very comfortable and quiet. * excellent handling…".
- **Example G60-3704 (US, BEVE, 17 rows):** range/seat/cabin-space review annotated with "Electric Range: Range, not OK", "Seats: Not comfortable", "Seats: Likes comfort" (both polarities on the same comment), "Luggage compartment: insufficient storage space", "Public charging…: Not user-friendly", etc.
- **Rule for the dashboard:** count unique IDs for any "how many customers" metric; rows only for per-category annotation volume. A category count never implies a distinct person.

## 2. Distributions (rows / unique IDs) [COMPUTED]

**Source:** A 1858/854 · B 2627/2626 · C 384/384 · D 136/136. Source B/C/D are ~1 row/ID (US-heavy verbatims); Source A is heavily multi-coded (2.18 rows/ID).
**Country:** US 4365/3610 · KR 278/205 · JP 76/53 · GB 89/36 · SE 51/28 · DK 49/20 · CA 41/18 · NO 17/8 · FI 14/9 · FR 14/8 · AU 7/3 · LV 3/1 · ES 1/1. US = **90.2%** of unique IDs.
**Engine Type:** ICE 2768/2259 · BEVE 1763/1363 (BEV label is "BEVE") · PHEV 474/378.
**Feedback Type:** Likes 1951/1791 · Difficult to Use 1306/1211 · Wants 582/537 · Defect 435/346 · blank 731/731.

**Source × Country (unique IDs):** Source B = 2626 all-US; C = 384 all-US; D = 136 all-US. Source A is the international source: US 464, KR 205, JP 53, GB 36, SE 28, DK 20, CA 18, FI 9, FR 8, NO 8, AU 3, LV 1, ES 1. [OBSERVED] **Every non-US comment in this workbook comes from Source A** — country comparisons are confounded with source/instrument differences [INFERRED].

**Country × Engine (unique IDs):** US ICE 2017 / BEVE 1271 / PHEV 322 · KR 164/19/22 · JP 42/11/0 · GB 23/6/7 · SE 1/14/13 · DK 0/20/0 · CA 6/8/4. [INFERRED] The KR sample is predominantly ICE; DK/SE skew electrified — consistent with market mix, but n is small outside the US.

## 3. Taxonomy [COMPUTED]

221 distinct level-2 values. Unclassified: 525 rows `no_class_found` + 200 rows null = 725 rows (14.5%); at ID level 725 IDs have ≥1 unclassified row, **440 IDs (11.0%) have *only* unclassified rows**.

Top 25 level-2 categories by unique IDs (like / dislike / want rows):

| # | Category | IDs | Rows | Like | Dislike | Want |
|---|---|---|---|---|---|---|
|1|Drivetrain|411|419|352|51|15|
|2|Handling / Riding|226|227|215|8|4|
|3|Body equipment, overall technology|211|213|128|60|25|
|4|Exterior design|157|157|144|0|13|
|5|Drive, driving dynamics and chassis, overall technology|126|126|124|0|0|
|6|Interior design|101|101|86|0|15|
|7|Electric Range|95|96|34|52|10|
|8|Seats|94|105|46|46|13|
|9|Touch screen, operation|70|72|37|30|5|
|10|My Modes / driving experience|58|59|27|19|13|
|11|Operating concept, operating system|52|53|21|18|14|
|12|Exterior|51|51|33|18|0|
|13|Interior comfort|51|51|49|0|2|
|14|Public charging / external providers|49|49|9|30|10|
|15|ConnectedDrive and Infotainment, overall technology|47|51|18|32|0|
|16|Apple CarPlay|45|45|9|33|3|
|17|Audio mode, sound|43|46|20|20|6|
|18|non-contact trunk lid opening|42|43|2|40|1|
|19|Highway assistant|38|38|23|12|3|
|20|Instrument cluster|38|39|7|25|7|
|21|Navigation|38|38|12|21|5|
|22|Ambient light|37|37|19|5|13|
|23|Braking|37|38|7|28|3|
|24|Automatic engine start-stop (MSA)|36|37|2|24|11|
|25|Head-Up Display|36|37|16|17|4|

[INFERRED] The car is overwhelmingly praised on dynamics/design (rows 1–6, 13); the pain is concentrated in **software/controls (9, 11, 15, 16, 18–25)** and **EV-specific usability (7, 14)**.

## 4. Top themes overall and US vs KR [COMPUTED]

Country sizes (unique IDs): US 3610, KR 205 (second-largest → analysed per task; JP 53 and GB 36 also clear n≥30 but were not requested; all others <30 → insufficient).

**Overall LIKE themes (top 15, by unique IDs):** Handling/Riding: Like function 209 · Drivetrain: Like performance 198 · Exterior design: design appeals 144 · Drive dynamics overall: Like function 124 · Interior design: design appeals 86 · Drivetrain: Like function 70 · Body equipment: Like function 66 · Drivetrain: Efficiency 51 · Interior comfort 49 · Body equipment: Workmanship appeals 42 · Exterior: Likes size 33 · Drivetrain: responsiveness 31 · Seats: Likes comfort 30 · Space impression 28 · Touch screen: design appeals 28.

**Overall DISLIKE themes (top 15):** Body equipment: Not user-friendly 60 · Electric Range: Range not OK 43 · non-contact trunk lid: Not user-friendly 39 · Public charging: Not user-friendly 24 · Vehicle lock/unlock: Not user-friendly 22 · Drivetrain: Drive power not OK 20 · Instrument cluster: Not user-friendly 19 · Driver profile: Not user-friendly 18 · Operating concept: Not user-friendly 18 · ConnectedDrive/Infotainment: Not user-friendly 17 · Luggage compartment: insufficient space 17 · My Modes: Not user-friendly 17 · Apple CarPlay: Not user-friendly 16 · Navigation: Not user-friendly 16 · Braking: Not user-friendly 15. **13 of 15 dislike themes are "Not user-friendly" — usability, not defects, dominates complaints** [INFERRED].

**Wants (top 3):** price-performance ratio dislike 17 · operating-system usability request 14 · exterior design request 13 (full list in JSON).

**US (n=3610):** likes mirror overall top-15 (Handling 168, Drivetrain perf 136, Exterior design 135); dislikes mirror overall, adding cruise control 14, air-con panel 14, MSA 14, braking 14. **KR (n=205):** likes — Drivetrain performance 43, dynamics overall 21, Handling 18, Efficiency 11; dislikes — *Drive power not OK 7*, *storage space 4*, Body equipment 3, Bluetooth pairing 2, map update 2. [INFERRED] US pain is digital-usability + EV charging; KR pain is powertrain expectations + storage, with almost no controls-complaints — but KR is entirely Source A while US mixes 4 sources, so the difference cannot be attributed to culture alone [OPEN]. JP/GB/SE/DK/CA have n<60 → directional only; every other country: **insufficient**.

## 5. Quotes for top-10 dislike categories (2 verbatim each, with record ID) [OBSERVED]

**Body equipment, overall technology (60 IDs):**
- G60-0063: "Customer explained there is much more to take in with this vehicle versus their 2024 model, and they are gradually learning how the electronics work […truncated]"
- G60-0162: "Customer stated he keeps running into various small issues while learning how the electronics work. Customer stated he e […truncated]"

**Electric Range (52 IDs):**
- G60-0034: "for a car on a newly developed model platform, the range should have been much better. i have to drive very slowly to ge […truncated]"
- G60-0195: "Customer stated the vehicle is only getting around 100 miles of range on a full charge, which is much lower than what th […truncated]"

**Drivetrain (51 IDs):**
- G60-0371: "there is simply no flawless design performance here"
- G60-0401: "no proper gear shifter, just that goofy little switch, and the controls are a pain to work with. half the settings don't […truncated]"

**Seats (42 IDs):**
- G60-0107: "I had a serious problem with Seat materials scuff/soil easily: \"The seats seem to stain kind of easily and I'm not reall […truncated]"
- G60-0236: "the interior feels like a step down from the previous model in both materials and equipment. no full leather on the das […truncated]"

**non-contact trunk lid opening (40 IDs):**
- G60-0180: "Customer stated the kick-to-open function is not working as smoothly as they would prefer, and even though the dealer sh […truncated]"
- G60-0488: "I had a minor problem with Trunk/hatch/tailgate - Touch-free sensor doesn't work consistently/DTU: \"Hard to figure out t […truncated]"

**Apple CarPlay (33 IDs):**
- G60-0094: "Customer stated that running Apple CarPlay and iDrive at the same time is challenging because once CarPlay connects, the […truncated]"
- G60-0202: "Customer stated wireless CarPlay will occasionally not connect. Customer stated he has had to reboot the phone, remove i […truncated]"

**Public charging / external providers (30 IDs):**
- G60-0159: "Customer reported that at times it is hard for her to locate a charging station that is compatible."
- G60-0273: "Customer stated that after coming from Tesla, the charging experience has been very different. Customer stated it has be […truncated]"

**ConnectedDrive and Infotainment, overall technology (29 IDs):**
- G60-0103: "Customer stated that in the last few weeks he has experienced a few tech problems with the vehicle. Customer stated the […truncated]"
- G60-0190: "the car itself is great. the idrive system is a bit confusing to use. having had seven bmws before, i really miss the ol […truncated]"

**Touch screen, operation (29 IDs):**
- G60-0033: "pros: front seat is wider than i thought, very convenient and clean with no oil smell, comfy ride, nice design. cons: to […truncated]"
- G60-0123: "steering wheel feels loose, and at times when you go to turn it just kind of locks up. the front camera also doesn't rea […truncated]"

**Braking (28 IDs):**
- G60-0240: "my bmw 530i is a really good car, but it still feels like it could be better. i'm very happy with the chassis and the su […truncated]"
- G60-0292: "I had a serious problem with Excessive brake dust: \"The wheels pick up dirt very quickly\""

## 6. Feature-level signals (taxonomy count vs keyword count reported separately) [COMPUTED]

Per unique ID; sentiment = dominant class of that ID's rows. "Taxonomy" = level-2 (or level-3 for controls-complexity) label match; "keyword" = regex on comment text. The two overlap but measure different things (classified aspect vs mentioned topic).

| Feature | Taxonomy IDs (like/dis/want) | Keyword IDs (like/dis/want) | Union IDs | By country (union, ≥3) |
|---|---|---|---|---|
|Rear-seat comfort/heating|97 (43/42/12)|47 (10/24/10)|135|US 127, KR 4|
|Seat heating/ventilation|94 (41/42/11)|29 (8/15/6)|120|US 111, KR 5|
|Exterior colour/paint|157 (144/0/13)|70 (33/21/14)|193|US 182, KR 9|
|Performance/power|728 (652/59/14)|243 (108/97/11)|849|US 662, KR 103, JP 30, GB 14, DK 11, SE 10|
|Digital/iDrive/infotainment/controls|307 (111/152/43)|772 (134/505/91)|877|US 828, KR 17, GB 12, SE 8, DK 6|
|Controls complexity (narrow: "Not user-friendly" class + confusion words)|912 (0/906/0)|71 (2/61/2)|—(912 ⊃ mostly)|US 880, KR 14, GB 5, SE 5, DK 4, CA 3|
|Driver assistance|199 (82/94/22)|80 (25/48/6)|213|US 203, GB 3, KR 3|

Read-outs [INFERRED]: (a) **Digital/controls is the single largest discussion surface** (877 unique IDs union, 61% dislike-dominant) — bigger than performance pain by an order of magnitude (performance mentions exist on 849 IDs but 77% are positive). (b) Rear-seat and seat-climate topics are near 50/50 like/dislike — features loved when present, complained about when absent/finicky; keyword-only mentions skew negative (rear seat 24 dis vs 10 like). (c) Exterior design/paint is almost purely a like asset (144 like / 0 dislike taxonomy rows). (d) Driver assistance splits 82 like / 94 dislike — trust/behaviour complaints, not availability [OBSERVED in quotes like G60 hands-off nagging]. Caveat: US carries ≥90% of every row in this table [COMPUTED].

## 7. Candidate BEHAVIOURAL segments [COMPUTED sizes on unique IDs; INFERRED labels]

Method: per-ID flags from keyword/taxonomy presence + sentiment composition (overlap allowed; not a partition of 4000).

| Segment (label = interpretation) | Definition (method) | Unique IDs | % of 4000 |
|---|---|---|---|
|Pure praisers|has like rows, no dislike rows|1672|41.8|
|Tech/digital-focused voices|digital taxonomy or tech keywords|571|14.3|
|Comfort-focused (positive)|comfort/seat/quiet keywords + like|424|10.6|
|Frustrated by controls/usability|"Not user-friendly" class or control words + dislike|334|8.3|
|Comfort-negated|comfort keywords + dislike|246|6.2|
|EV range/charging concerned (BEV/PHEV only)|range keywords + dislike/want|244|6.1|
|Performance enthusiasts|dynamics keywords + like|219|5.5|
|Value/cost voiced|price/value/cost words present|126|3.2|
|Mixed praisers-critics|both like and dislike|119|3.0 (small because multi-topic reviews also carry likes; see caveat)|

"Controls-frustrated" splits BEVE 90 / ICE 214 / PHEV 30; tech-focus is 534/571 US.
[INFERRED] Honest dashboard segments: "delighted ambassadors", "digital-frustrated", "comfort-sensitive", "range-anxious EV owners", "driving-dynamics fans". **NOT knowable from this data:** age, gender, income, household, profession, ownership history (not in data), geography below country, purchase funnel stage. "Mixed 119" is method-sensitive because long multi-topic reviews dominate row counts — treat segment overlaps explicitly in the UI.

## 8. Data quality & caveats [COMPUTED/OPEN]

2. **US dominance:** 90.2% of IDs; besides US only KR (205), JP (53) and GB (36) exceed n=30. Regional claims beyond US-vs-KR are underpowered [COMPUTED].
2. **Source confound:** all non-US rows are Source A; Source A also carries all 525 of its IDs with null Feedback Type (Source D: all 136; Source C: 70). Source A rows are 2.18/ID (multi-coded taxonomy feed), B/C/D ~1/ID (verbatim feeds). Comparing countries = comparing instruments [COMPUTED/INFERRED].
3. **Free-text heterogeneity:** median 151 chars; 58 IDs >1000 chars (max 3498) are multi-topic reviews whose single text spans many themes — keyword counts on them over-attribute topics [COMPUTED]. Some rows are third-person summaries ("Customer stated…") vs first-person verbatims — two recording styles mixed [OBSERVED].
4. **Sentiment is per-annotation, not per-comment:** 119 IDs hold both likes and dislikes; a comment can be "like" on one row and "dislike" on another [COMPUTED]. 731 rows/IDs have null Feedback Type (unlabeled, not neutral).
5. **Taxonomy gaps:** 14.5% rows unclassified (`no_class_found` 525 + null 200); 440 IDs (11%) wholly unclassified. 221 level-2 labels with near-duplicates ("Exterior design" vs "Exterior"; two "…overall technology" mega-labels) — needs a mapping layer before UI grouping [COMPUTED/OBSERVED].
6. **Label quirk:** BEV appears as "BEVE". Brand/Sales Description/Derivate columns are constant — zero information [OBSERVED].
7. **No weighting:** no survey weights, model/trim detail (only e-code G60), purchase date, or demographics; volumes in `sales_volumes.xlsx` are not keyed to these IDs [OPEN]. Sample is self-selected (owners who gave feedback), not a representative panel [OPEN].
