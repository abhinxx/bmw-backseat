# C — BMW F70 (1 Series) Feedback Analysis

**Source:** `BMW-Data/F70_feedback_hackathon.xlsx`, sheet `Feedback_Explorer` (read-only).
**Scripts (all re-run in this session, exit 0):** `research/scripts/C_01_profile.py` … `C_07_merge.py`.
**Consolidated data:** `research/data/C_f70_aggregates.json` (merge of `C_f70_part1/part2/quotes/features/features_byc/segments/quality.json`).
**Definitions used throughout [COMPUTED]:** *Like* = `Feedback Type == "Likes"`; *Dislike/negative* = `Feedback Type ∈ {Defect, Difficult to Use, Wants}`. "Dislikes" in tables is this union, not a single workbook value.
**Context [OBSERVED]:** every row is Brand `[BMW]`, Sales Description `[BMW 1 Series]`, Derivate `F70`, Engine Type `ICE`, Source `Source A` — consistent across all 2,128 IDs. The F70 is sold in Europe/Rest-of-World only; consistent with that, no US/China rows appear.

Tags: [OBSERVED] = direct from a script output; [COMPUTED] = derived arithmetic from saved outputs; [INFERRED] = interpretation; [OPEN] = unresolved.

---

## 1. Rows vs unique IDs vs unique texts [OBSERVED — C_01]

| Measure | Count |
|---|---|
| Rows | **4,076** |
| Unique IDs | **2,128** (F70-0001…F70-2128, no gaps [OBSERVED — C_06]) |
| Unique comment texts (case/whitespace-normalised) | **2,128** |
| Mean rows per ID | 1.915 |

Rows ≠ customers: one customer comment (ID) is exploded into one row per taxonomy hit. Rows/ID distribution: 1→1,119 IDs; 2→535; 3→242; 4→113; 5→61; 6→26; 7→18; 8→9; 9→1; 10→3; 11→1. Every text is unique to one ID (0 texts shared across IDs), so **ID == unique customer comment**.

**Multi-category duplication mechanism [OBSERVED]:** the same verbatim text repeats across rows with different (Feedback Type, Vfc level2, Vfc level3) label sets.

- **F70-0002** (2 rows, identical text): row 1 = `Likes / Body equipment, overall technology / Workmanship appeals`; row 2 = `Difficult to Use / Owner's Manual / Not user-friendly`. One comment praised build *and* complained about the manual → two rows, two feedback types.
- **F70-0003** (2 rows, identical text): row 1 = `Likes / Impression of safety / Like: function`; row 2 = `nan / no_class_found / nan` — the second row is the classifier's "residual" row.

Consequence: any row-level count double-counts customers; all headline numbers below are unique-ID based.

## 2. Distributions & cross-tabs [OBSERVED — C_01]

**Source:** `Source A` only (2,128 IDs / 4,076 rows) — no source mix to analyse.
**Country (unique IDs | rows):** GB 1,293 | 2,790 · JP 672 | 1,026 · SE 71 | 121 · FR 53 | 75 · AU 16 | 30 · DK 8 | 13 · FI 8 | 11 · KR 4 | 5 · ZA 3 | 5. GB+JP = **1,965/2,128 = 92.3% [COMPUTED]** of all IDs.
**Engine Type:** `ICE` for 100% (2,128 IDs). No BEV/PHEV rows [OBSERVED].
**Feedback Type — rows:** Likes 1,630 · nan 1,087 · Difficult to Use 595 · Defect 491 · Wants 273. **Per (ID, Feedback Type) pairs:** Likes 1,284 · nan 1,087 · Difficult to Use 462 · Defect 372 · Wants 249 [OBSERVED — C_02].
Per-ID sentiment mix [OBSERVED — C_02]: likes-only 1,011 · negative-only 544 · both like & negative 273 · only-unclassified 300. So **817 IDs (38.4% [COMPUTED]) carry ≥1 negative row; 1,284 (60.3%) carry ≥1 like**.

**Cross-tab Source × Country:** degenerate — single source, so it equals the country distribution above.
**Cross-tab Country × Engine (unique IDs):** ICE-only column: GB 1,293, JP 672, SE 71, FR 53, AU 16, DK 8, FI 8, KR 4, ZA 3. Row/ID counts are identical because Engine never varies per ID (consistency check: 0 inconsistent IDs for Country, Source, Engine Type, Derivate, Sales Description [OBSERVED — C_02]).

## 3. Top 25 level-2 categories, unique IDs, Likes/Dislikes [OBSERVED — C_02]

L = IDs with a Likes row in the category; D = IDs with a negative row. (An ID can appear in both.)

| # | level2 | IDs | L | D |
|---|---|---|---|---|
| 1 | no_class_found | 1,087 | 0 | 0 |
| 2 | Drivetrain | 527 | 424 | 115 |
| 3 | Drive, driving dynamics and chassis, overall technology | 475 | 475 | 0 |
| 4 | Handling / Riding | 215 | 179 | 37 |
| 5 | Touch screen, operation | 137 | 20 | 119 |
| 6 | ConnectedDrive and Infotainment, overall technology | 119 | 27 | 96 |
| 7 | Body equipment, overall technology | 98 | 54 | 45 |
| 8 | Seats | 96 | 51 | 46 |
| 9 | Owner's Manual | 64 | 3 | 61 |
| 10 | Impression of safety | 59 | 47 | 12 |
| 11 | Exterior design | 56 | 56 | 0 |
| 12 | My Modes / driving experience | 46 | 30 | 17 |
| 13 | Cushioning / damping vehicle | 42 | 16 | 27 |
| 14 | General enquiry: customer feedback | 40 | 0 | 40 |
| 15 | Transmission | 40 | 16 | 24 |
| 16 | Driver assistance, automated driving, overall technology | 39 | 20 | 19 |
| 17 | Audio mode, sound | 35 | 6 | 30 |
| 18 | Navigation | 33 | 5 | 29 |
| 19 | Exterior rearview mirror | 32 | 8 | 24 |
| 20 | Interior design | 29 | 26 | 3 |
| 21 | Braking | 28 | 7 | 21 |
| 22 | Exterior | 28 | 15 | 13 |
| 23 | Wheels / tires | 27 | 1 | 26 |
| 24 | Luggage compartment | 25 | 7 | 18 |
| 25 | Engine acoustics / engine sound | 23 | 9 | 14 |

120 distinct level-2 labels in total [OBSERVED].

**Unclassified rate [OBSERVED — C_02]:** 1,087 rows are `no_class_found` (26.7% of rows [COMPUTED]); 1,087 IDs (51.1%) have at least one unclassified row — i.e. classification coverage is roughly per-aspect, not per-customer; **300 IDs (14.1%) have no usable classification at all.**

## 4. Top-15 dislike and like themes [OBSERVED — C_02]

Overall dislikes = overall per-country GB list (GB drives the overall ranking). n-threshold: country sample ≥30 IDs.

**Overall dislikes (IDs):** Touch screen, operation 119 · Drivetrain 115 · ConnectedDrive/Infotainment 96 · Owner's Manual 61 · Seats 46 · Body equipment 45 · General enquiry 40 · Handling/Riding 37 · Audio mode, sound 30 · Navigation 29 · Cushioning/damping 27 · Wheels/tires 26 · Exterior rearview mirror 24 · Transmission 24 · Braking 21.
**Overall likes (IDs):** Drive/dynamics overall 475 · Drivetrain 424 · Handling/Riding 179 · Exterior design 56 · Body equipment 54 · Seats 51 · Impression of safety 47 · My Modes 30 · ConnectedDrive 27 · Interior design 26 · Driver assistance 20 · Touch screen 20 · Vehicle safety 17 · Cushioning 16 · Transmission 16.

**GB (n=1,293 ≥30 — reported):** dislikes mirror overall (Touch screen 103, ConnectedDrive 77, Drivetrain 69, Owner's Manual 56, Seats 37, General enquiry 33, Body equipment 27, Transmission 22, Wheels/tires 21, Cushioning 20, Mirror 20, Audio 19, Driver assistance 18, Navigation 16, Climatization 16); likes mirror overall GB-weighted (Dynamics 355, Drivetrain 210, Handling 57, Exterior design 41, Body equipment 40, Seats 37…).
**JP (n=672 ≥30 — reported):** dislikes: Drivetrain 41, Handling/Riding 23, Body equipment 14, ConnectedDrive 14, Navigation 13, Touch screen 11, Audio 7, Braking 7, Cushioning 6, Engine sound 6, Door 5, Safety impression 5, Seats 5, USB port 5, Mirror 4 (only 6 themes ≥10 IDs). Likes: Drivetrain 195, Handling/Riding 119, Dynamics 74, Impression of safety 26, Exterior design 14, Body equipment 11, Cushioning 10.

SE (71) and FR (53) also meet n≥30 but **no single theme reaches even 10 IDs on the dislike side — theme-level signal insufficient [OBSERVED]**.
Country contrast [INFERRED from above]: GB pain is digital/controls (Touch screen 8.0% and ConnectedDrive 6.0% of GB IDs negative); JP pain is drivetrain/hardware (Drivetrain 6.1%, Handling 3.4%) and JP praise is more handling-centric (Handling like-rate 17.7% vs GB 4.4%).

## 5. Verbatim quotes for the top-10 dislike categories [OBSERVED — C_03, `C_f70_quotes.json`]

All quotes are exact workbook text (workbook stores text lower-cased), whitespace-normalised, ≤200 chars, `"..."` = truncated by the script at 197 chars. Each quote is the full multi-aspect comment; the labelled aspect is only part of it (caveat §8).

**Touch screen, operation** — F70-1107 (AU, Difficult to Use): "i absolutely adore my 118. i really enjoy how smooth the steering wheel feels and how nicely the car drives overall. i like all the features on the 118, especially the cameras that show the street ..." · F70-0817 (JP, Defect): "i am happy with how the car performs and with the driving itself, but i feel the control system and software still need work. in particular, these areas are below what i could recommend. [controls ..."
**Drivetrain** — F70-1235 (GB, Defect): "as a daily driver it is very nice and has plenty of punch when you ask for it, but as a sporty car it feels too sterile - very fast yet no character, no proper noise apart from the fake stuff. maki..." · F70-1584 (GB, Difficult to Use): "last 7 cars were bmws, but because the new 1-series launch was delayed my previous car ended up being a mercedes. very pleased to be back in a bmw! overall i am really happy with this car, so the p..."
**ConnectedDrive and Infotainment, overall technology** — F70-0817 (JP, Difficult to Use, same comment as above, second aspect) · F70-2109 (GB, Difficult to Use): "this is my first petrol 1 series after having had four previous bmw 1 series sport models, and while i do enjoy how it drives, there are some things that really annoy me. the biggest frustration is..."
**Owner's Manual** — F70-0186 (GB, Wants): "i would really have liked the option of a manual gearbox, and that would have pushed my rating higher, but as with many brands it seems bmw no longer offers this to buyers. overall the car is great..." · F70-1703 (GB, Wants): "my issue is that i find modern technology hard to cope with. it all feels very complicated. it ended up taking about 3 months before i got an owner's handbook, and that only arrived after i kept on..."
**Seats** — F70-2068 (JP, Defect): "too many issues 1. the rubber gasket on the rear door, even though it is a new car, was already damaged and leaking. 2. the mirrors on this new car make a squeaky noise whenever opening or closing...." · F70-1817 (GB, Wants): "gearbox has a weird glitch coming up to junctions, it wont drop into the lowest gear until i actually press the throttle, which then makes the car lurch forward in a jerky way. the bmw maps have co..."
**Body equipment, overall technology** — F70-1107 (AU, Wants, same comment as Touch-screen quote) · F70-2050 (GB, Difficult to Use): "the inability to properly control the driving modes is really annoying. the disappearance of buttons and the idrive wheel to manage things is a pain. the touch screen itself is very good, but it pu..."
**General enquiry: customer feedback** — F70-0788 (GB, Difficult to Use): "overall this m135 is a big step down from my old 128ti, nowhere near as good. it just isnt as nice to drive, it tends to understeer and is awkward to manoeuvre slowly, especially parking, because t..." · F70-2037 (GB, Difficult to Use): "the car itself has attractive lines and drives well, but the support from the dealership before the purchase and after collection was not acceptable. i had to go back several times with complaints ..."
**Handling / Riding** — F70-1817 (GB, Wants, same comment as Seats quote) · F70-2037 (GB, Defect, same comment as General-enquiry quote)
**Audio mode, sound** — F70-2050 (GB, Defect, same comment as Body-equipment quote) · F70-0373 (GB, Defect): "i'm happy with how the car looks, but there are a few things i don't like compared with my old bmws (2015 1 series and 2016 2 series). the rear view mirror feels very distorted and kind of zoomed i..."
**Navigation** — F70-0085 (GB, Defect): "after my husband changed his phone he has not been able to load the bmw app, and even though he has asked for help he just keeps getting passed around. on the day we collected the car it was not re..." · F70-0216 (GB, Defect): "overall it is a good car but i do have issues: drivetrain - it behaves more like a plain fwd than a rear-biased 4wd and you can feel torque steer. dashboard controls - getting rid of the physical b..."

## 6. Feature signals [OBSERVED — C_04 / C_06; per-country split `C_f70_features_byc.json`]

Unique IDs, union of taxonomy path (level-2/level-2·3 labels) and keyword path on de-duplicated comment text; L/D = like/negative IDs inside the union (can overlap). Countries shown where ≥5 IDs.

| Feature | Tax | Kw | **Union** | L | D | GB (ids/L/D) | JP (ids/L/D) | Other ≥5 |
|---|---|---|---|---|---|---|---|---|
| Performance / power | 593 | 346 | **665** | 520 | 280 | 376/279/188 | 260/219/81 | SE 13/8/6 |
| Digital iDrive/infotainment/controls complexity | 325 | 300 | **427** | 219 | 343 | 340/182/274 | 64/27/53 | SE 10/7/5, FR 7/1/6 |
| Rear-seat comfort/space | 154 | 23 | **166** | 107 | 114 | 132/82/97 | 22/16/11 | SE 7/5/3 |
| Price / value | 44 | 166 | **176** | 104 | 100 | 108/51/74 | 59/46/21 | SE 6/5/3 |
| Driver assistance | 95 | 63 | **115** | 79 | 81 | 90/60/69 | 19/16/7 | — |
| Exterior colours / paint | 83 | 45 | **113** | 97 | 41 | 83/69/34 | 25/23/5 | — |
| Seat heating | 23 | 19 | **30** | 17 | 25 | 25/14/21 | — | — |

Taxonomy-vs-keyword gaps worth noting [COMPUTED from table]: price/value barely exists in the taxonomy (44) but surfaces via keywords (166) → the classifier under-captures price talk; digital friction skews negative (D 343 > L 219, only feature where negatives clearly dominate); performance/power skews positive (L 520 > D 280); seat heating is small (30) and net-negative (25 D), essentially a GB-only signal. JP never dominates the negative side of any feature except drivetrain-adjacent performance [INFERRED]. Caveats: keyword regexes are English-centric (JP texts are transliterated/translated English — only 5/672 CJK [OBSERVED — C_06], but coverage still likely lower for JP [INFERRED]); "fast/complicated/camera" keywords over-capture and taxonomy lists embed analyst judgement (see specs in `C_04_features.py`) [OPEN].

## 7. Candidate behavioural segments [OBSERVED sizes — C_05; `C_f70_segments.json`]

**Method:** segments defined purely on observable feedback behaviour (workbook Feedback Type + taxonomy labels + text length) at unique-ID level; no demographics invented because none exist in the data.

Valence segments (mutually exclusive, 2,128 total): **praise_only 1,011 (47.5%) · complaint_only 544 (25.6%) · unclassified_only 300 (14.1%) · mixed_praise_and_complaint 273 (12.8%)** [COMPUTED %].
Behavioural overlays (overlap allowed; % of 2,128; GB/JP share):
- **S4 Driving-dynamics advocate — 998 (46.9%)** — Likes on dynamics/chassis labels. GB 562, JP 368. The car's core strength.
- **S6 Detailed long-form reviewer — 532 (25.0%)** (text ≥ p75 = 272 chars). GB 432-heavy → GB feedback is more detailed; treat GB-vs-rest differences partly as sampling artefact [INFERRED].
- **S5 Hard-to-use reporter — 462 (21.7%)** — any `Difficult to Use` row. GB 334, JP 100.
- **S2 Quality/defect reporter — 372 (17.5%)** — any `Defect` row. GB 289, JP 59. Overlaps S6 at 240 IDs.
- **S1 Digital-friction complainer — 295 (13.9%)** — negative rows on digital/manual labels. GB 237, JP 43. Strongly a GB/Europe pattern.
- **S3 Feature requester — 249 (11.7%)** — any `Wants` row.
- **S7 Manual/docs struggler — 61 (2.9%)** — negative `Owner's Manual`.
Overlaps are informative (e.g. S1∩S5 = 231 of 295 digital complainers also report usability difficulty).
**What is NOT knowable [OPEN]:** age, gender, income, occupation, tenure, mileage, trim/option purchase behaviour — none in data ('not in data'). Segments describe what people complained about, not who they are; country is the only population attribute (and even country coverage is skewed).

## 8. Data quality issues & caveats [OBSERVED unless tagged]

1. **Rows ≠ customers.** 4,076 rows = 2,128 comments; row-level stats inflate multi-aspect comments up to 11×. Use unique-ID counts (all headline numbers here do).
2. **Classification sparsity:** 26.7% of rows and 14.1% of IDs entirely unclassified; 51.1% of IDs have at least one unclassified aspect. Theme rankings understate real prevalence [INFERRED].
3. **Sample skew:** GB 60.8% + JP 31.6% of IDs; SE/FR/AU/DK/FI/KR/ZA are single/low-double digits — no honest country comparison possible beyond GB/JP. F70 sells in Europe/RoW only; the workbook contains no US/China rows (consistent with the market footprint).
4. **Single value columns:** Source, Brand, Sales Description, Derivate, Engine Type carry one value each → zero analytical variance; engine-type "analysis" is impossible (all ICE).
5. **`General enquiry: customer feedback` (40 IDs, all negative-flagged)** is a catch-all mixing dealer-service complaints with product complaints (quotes F70-0788, F70-2037) — don't treat it as a product theme.
6. **Quotes are whole multi-aspect comments**, truncated at 200 chars; a quote under category X contains the labelled aspect somewhere, not necessarily in the visible 200 chars (e.g. F70-0186 under Owner's Manual reads as a gearbox wish; F70-2068 under Seats leads with door-gasket defects). The full text is on the record ID.
7. **Texts are pre-lower-cased** in the workbook; 20 GB texts contain non-ASCII punctuation; 5 JP texts contain CJK characters. English-keyword paths may undercount JP [INFERRED].
8. **Feedback Type is per-aspect and nullable** (1,087 `nan` rows): "Likes + Wants" on the same comment is normal, so like/dislike shares sum >100% and sentiment is not a clean per-customer split.
9. **No dates, no severity, no rating, no trim/option fields** → no trend, no impact-weighting, no option-level prioritisation from this workbook [OPEN].
10. **Small-base honesty:** seat heating (30 IDs) and any theme in SE/FR/other countries fall below reporting thresholds; label as insufficient rather than ranking them.
11. Previous-run artefact fixed in-session: `C_05_segments.py` previously crashed writing `C_f70_segments.json` (numpy int64 not JSON-serialisable, file was truncated mid-dump); fixed with int-casting + JSON default, re-run clean.

---
*All numbers traceable to `research/data/C_f70_aggregates.json` produced by `research/scripts/C_01..C_07*.py`.*
