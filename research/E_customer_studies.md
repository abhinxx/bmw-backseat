# Report E — Customer Studies Workbook (F70_G60_G68_G70_customer_studies.xlsx)

Source: `BMW-Data/F70_G60_G68_G70_customer_studies.xlsx` (read-only).
Scripts: `research/scripts/E_01_dump_structure.py`, `E_02_structure.py`, `E_03_extract.py` (all run with project `.venv/bin/python`).
Machine data: `research/data/E_studies_long.csv` (3,275 rows), `research/data/E_studies.json`, `research/data/E_raw_dump.txt` (full cell dump), `research/data/E_structure_report.json`, `research/data/E_cneu_table.txt`.
Tags: [OBSERVED] raw fact, [COMPUTED] from saved script, [INFERRED] interpretation, [OPEN] unknown.

---

## 1. Exact structure of each sheet

### Sheet `CN_EU_2025` (A1:M84; data only in A1:F76) [OBSERVED]

- **B1** = `'Dataset country'`. **Row 2** carries dataset-country labels: B2=`China`, D2=`EU` (no merged cells; columns inherit: B,C→China; D,E,F→EU). [OBSERVED]
- **Row 3** = model column headers: B3 `BMW 5 Series G68` (China), C3 `BMW 7 Series G70` (China), D3 `BMW 1 Series F70` (EU), E3 `BMW 5 Series G60` (EU), F3 `BMW 7 Series G70` (EU). Note: G70 appears twice (China and EU columns). [OBSERVED]
- **Body = 37 blocks**, each 2 rows: attribute-title row (col A) followed by a row whose col A = `'Mean'` and B:F = values. Block title rows 3→75 step 2; last block `Connected services` (A73/A74), `Interior versatility` (A75/A76). Rows 77–84 fully empty. Columns G–M empty everywhere. [OBSERVED]
- **Values are means** (single 'Mean' row; no distribution rows). Range [COMPUTED, E_02]: 6.468 (`Value for money`, G70-EU, F18) to 9.948 (`Quality of ride`, G60-EU, E52). **No other statistic (SD, distribution) is present.** [OBSERVED]
- **Rating scale direction:** higher = better (means near the top for liked items). **Scale bounds are not stated anywhere in the sheet.** Values ≤ 9.95 are consistent with a 1–10 (or 0–10) scale. [INFERRED] → scale = **[OPEN]**.
- **Sample sizes: absent.** No n, base, or count anywhere in the sheet (all 13 columns inspected cell-by-cell). [OBSERVED]
- No formulas in the entire workbook (`E_formulas.txt`: 0) — every value is a hard-coded number. [OBSERVED]
- All 5 models carry all 37 attributes; no missing mean cells. [COMPUTED]

### Sheet `US_2025` (A1:E934; data in A:D only, column E entirely empty) [OBSERVED]

- **Row 1** headers: A1 first block title, C1 `BMW 5 Series G60`, D1 `BMW 7 Series G70 ` (trailing space). **No market label cell** — market "US" is [INFERRED] from sheet name.
- **103 question blocks**, each: title row (col A) → `'Sample total'` row (col B = `'% of column, sample base'`) → 7 rating-level rows. Every level row's col B repeats `'% of column, sample base'` (707 rows [COMPUTED]).
- **Rating scale (7-point ordinal, ascending downward in every one of the 103 blocks, identical level sequence):**
  1 `I Hate It` < 2 `A Failure` < 3 `Unsatisfactory` < 4 `Satisfactory` < 5 `Excellent` < 6 `Delightful` < 7 `I Love It`. Higher row = better. [OBSERVED]
- **Values are shares** (0–1 proportions of the column base), not means. Min 0.002, max 0.632 across 1,414 level cells. [COMPUTED, E_02]
- **`Sample total` row = exactly 1 (=100%) in both columns for all 103 blocks** — it is the percentage total, **not a sample count. Sample sizes (n) are absent from the whole workbook.** [OBSERVED/COMPUTED]
- **Sum check [COMPUTED]:** the 7 level shares sum to 1.000 ± 0.0005 for all 103×2 = 206 column-blocks (count off by >0.001: 2 blocks, but that was an E_02 parser artifact — blank rows 867 and 877 inside two blocks; after fix, E_03 finds zero sum anomalies).
- **Layout quirks [OBSERVED]:** rows 867 (inside `If applicable: Interactive information system…` block, between 'Sample total' and 'I Hate It') and 877 (inside `Performance of voice recognition`) are blank; column E empty; last block ends at A929 (sheet extends to 934, trailing empties).
- ~24 of the 103 titles are prefixed `'If applicable:'` (4WD/AWD, Off-Road, Sunroof, Navigation, Interactive info system, Flat tire, Ease of customization, Backup system) → base may differ per question, but bases are not disclosed. [OBSERVED] + [INFERRED]
- 2 blocks have 0 level rows on first strict parse (E_02) purely due to the blank rows — data itself is complete (7 levels each). [COMPUTED]

---

## 2. Tidy long-format extraction

`research/data/E_studies_long.csv` — 3,275 rows, columns `sheet, market, model, attribute, metric, value, n_if_available, source_cell`. [COMPUTED, E_03]

- **CN_EU_2025:** 185 rows = 37 attributes × 5 models, `metric='mean'`, `source_cell` = exact cell (e.g. `CN_EU_2025!C34`). `n_if_available` is blank everywhere (no n exists). [OBSERVED]
- **US_2025:** raw rows = 103 attributes × 2 models × (7 level shares `share_i_hate_it … share_i_love_it` + 1 `sample_total_share`) = 1,648 rows, each with exact cell (e.g. `US_2025!D9`). Plus 1,442 [COMPUTED] rows (`metric` = `top1box, top2box, top3box, bottom1box, bottom2box, bottom3box, mean_from_shares_1to7`) whose `source_cell` names the exact 7-row span they were computed from. Every raw value traces to one cell; every derived value names its inputs.
- [OBSERVED] The duplicate-title count in E_structure_report.json ("5" per CN/EU title, "2" per US title) is just the model columns per title — no true duplicate attributes within a market/model pair.

## 3. US: top-/bottom-box per attribute, G60 vs G70

**Definitions (explicit) [COMPUTED, E_03]:**
- Top-1-box = `I Love It` share. **Top-2-box = `Delightful` + `I Love It`.** Top-3-box adds `Excellent`.
- Bottom-1-box = `I Hate It`. **Bottom-2-box = `I Hate It` + `A Failure`.** Bottom-3-box adds `Unsatisfactory`.
- `mean_from_shares_1to7` = Σ share×level (1=I Hate It … 7=I Love It) — a computed summary, not a published mean.
- 103 attributes ranked per model (full lists in `E_studies.json → US_rankings`).

**G60 strongest (top-2-box):** Reputation/prestige 0.705 · Headlight function 0.703 · Handling/Maneuverability 0.699 · Brand image 0.697 · Tires/wheels 0.686 · Riding comfort 0.684 · Front seat roominess 0.683 · Acceleration from stop 0.679 · Seat comfort 0.666 · Durability/reliability 0.660 (+ Interior colors 0.653, Front seat comfort 0.653, Driving performance 0.648, Trim/finish 0.643, Exterior styling 0.638). [COMPUTED]
**G60 weakest:** Off-Road 0.169 · Affordable to buy 0.197 · Economical to own 0.281 · Heater/AC controls operation 0.289 · Ground clearance 0.345 · Flat tire 0.353 · Interactive info system 0.357 · Infotainment menu 0.357 · Climate control 0.357 · Value for money 0.376 · WiFi hotspot 0.383 · Standard equipment 0.383 · Voice recognition 0.385 (+ resale 0.359, price/deal 0.363). [COMPUTED]

**G70 strongest:** 2nd row seat roominess 0.779 · Front seat roominess 0.766 · Riding comfort 0.749 · **Comfort of 2nd row seat 0.736** · Overall seat comfort 0.661 · Ease of 2nd row entry 0.657 · Prestige 0.655 · Acceleration 0.643 · Driving performance 0.642 · Wind/road noise 0.641. [COMPUTED]
**G70 weakest:** Affordable to buy 0.063 · Resale 0.132 · Price/deal 0.143 · Economical to own 0.163 · **Intuitiveness of controls 0.249** · Warranty 0.261 · Place for phone 0.266 · Flat tire 0.269 · Off-Road 0.269 · **Value for money 0.271** · Ease of customization 0.276 · Interactive info system 0.278 · WiFi 0.279 · Placement of controls 0.298 · Infotainment menu 0.319. [COMPUTED]

**G60 − G70 top-2-box, largest gaps [COMPUTED, E_studies.json]:** G70 wins big on 2nd row seat roominess (+0.306), Comfort of 2nd row seat (+0.265), Ease of 2nd row entry (+0.199) — the rear cabin. G60 wins on Place for phone (+0.264), Tires/wheels (+0.262), resale (+0.227), Price/deal (+0.220), bass (+0.206), audio clarity (+0.199). Controls/HMI: G70 is *worse* (Intuitiveness 0.249 vs 0.422; bottom-2-box 0.119 vs 0.022 — 5× the negative share). [OBSERVED in cells US_2025!C480-D486 region]

## 4. CN vs EU: means per model, G70 China vs EU

Full 37×(5 models + delta) table: `research/data/E_cneu_table.txt`; per-cell values in the CSV. Key rows (China G68 | China G70 | EU F70 | EU G60 | EU G70 | G70 CN−EU) [COMPUTED]:

| Attribute | G68-CN | G70-CN | F70-EU | G60-EU | G70-EU | ΔG70 |
|---|---|---|---|---|---|---|
| Overall product satisfaction | 8.77 | **9.64** | 8.46 | 8.32 | 7.98 | **+1.65** |
| Exterior styling | 8.19 | 8.79 | 9.01 | **9.83** | 8.38 | +0.41 |
| Value for money | 7.92 | 8.29 | 7.82 | 7.36 | **6.47** | +1.82 |
| Rear interior roominess | **8.71** | **7.52** | 8.59 | 7.46 | **9.41** | **−1.89** |
| Front interior roominess | 7.77 | 7.69 | 9.20 | 8.88 | 9.69 | −2.00 |
| Quality of ride | 8.45 | 8.62 | 9.20 | **9.95** | 9.52 | −0.89 |
| Heating/ventilation/A/C | 7.58 | 8.82 | 7.30 | 7.47 | 8.80 | +0.02 |
| Overall seating comfort | 8.67 | 8.72 | 8.98 | 8.81 | 9.29 | −0.57 |
| Connected services | 7.35 | 7.32 | 7.36 | 7.37 | 7.86 | −0.54 |
| Sportiness | 8.86 | 8.64 | 9.34 | 7.64 | 6.97 | +1.67 |

**G70 China vs EU, largest deltas [COMPUTED]:** China higher — Overall satisfaction +1.65, Value for money +1.82, Sportiness +1.67. EU higher — Front roominess −2.00, **Rear roominess −1.89**, Braking −1.79, Reliability −1.46, Ease of loading −1.21. [OBSERVED cells e.g. C56 vs F56.]
**Model-coverage caveat [OBSERVED]:** G68 exists **only** in the China dataset; F70 **only** in the EU dataset. Cross-market model comparison is only legitimate for G70 (both) and, across different markets, nothing else. China-vs-EU differences confound market and (for non-G70) model.
**Notable:** G70-China rates its own rear roominess 7.52 while G70-EU rates the same model's rear roominess 9.41 — in China, where the car is sold as the long-wheelbase-ish flagship; [INFERRED] expectation-level or respondent-mix effect, not a physical difference. Lowest CN/EU values overall: G70-EU Value for money 6.47 (F18) and Sportiness 6.97 (F46); China G68's weak spots: Ease of loading 7.25 (B58), Braking 7.38 (B16), Connected services 7.35 (B74). Connected services is the *only* attribute at ~7.3–7.9 across all five columns — a universal weak spot [COMPUTED].

## 5. Comparability: US distribution vs CN/EU means

**Legitimate [INFERRED]:**
- Within US_2025: compare G60 vs G70 per attribute, ranks, and top/bottom-box — same instrument, same scale, same year. Shares sum to 1, so top-2/bottom-2 boxes are well-defined.
- Within CN_EU_2025: compare means across models/markets — same instrument. G70-China vs G70-EU is the only clean model-constant comparison.
- Within-sheet ordinal statements ("controls rank bottom in both US G70 and… no — see mapping") and sign/direction of differences.

**Not legitimate:**
- **Directly comparing US numbers with CN/EU numbers.** Different response types (distribution of 7-point verbal scale vs mean of an unlabeled — likely 10-point — numeric scale), different year markets, no n on either side, no published US mean. `mean_from_shares_1to7` is *our* computation on a 1–7 anchor; it is **not** commensurable with a 1–10-ish mean. [OPEN: CN/EU scale bounds; both sheets' n].
- Comparing across sheets on the assumption that "Satisfactory" (mid of 7) equals the scale midpoint of the CN/EU mean.
- Treating 'Sample total = 1' as an n, or 'If applicable' blocks as having the same base as core blocks — bases are undisclosed.
- Any variance/significance statement: no dispersion, no n. All rankings are point estimates.

**Safe synthesis:** use *rank position* within each sheet (strongest/weakest quartile) as the only cross-sheet bridge, and treat convergence (e.g. value-for-money weak in US-G70 *and* G70-EU; controls/infotainment weak in US both models *and* Connected/infotainment soft in CN/EU) as qualitative corroboration, not arithmetic.

## 6. Mapping to PM example features

| PM feature | US_2025 attribute(s) [OBSERVED] | CN_EU_2025 attribute(s) [OBSERVED] | Evidence [COMPUTED] |
|---|---|---|---|
| Rear-seat comfort | `Comfort of 2nd row seat`, `2nd row seat roominess`, `Ease of 2nd row seat entry` | `Overall seating comfort`, `Rear interior roominess` | G70 2nd-row comfort top2 0.736 vs G60 0.471; CN/EU G70-EU rear roominess 9.41 (F56) but G70-CN 7.52 (C56) |
| Seat heating / climate | `Overall performance of climate control system`, `Heater performance`, `Operation of heater/AC controls` | `Heating/ ventilation/ air conditioning` | Weak everywhere: US G60 climate top2 0.357 (worst-15); heater/AC controls 0.289; CN/EU HVAC 7.30–8.82 (F70-EU lowest 7.30, D66) |
| Exterior colours / styling | `Overall exterior styling`, `Size/proportions`, `Appearance of tires/wheels` (no explicit "exterior colours"; closest: `Interior colors`) | `Exterior styling` | G60 exterior top2 0.638 > G70 0.527; CN/EU: G60-EU exterior 9.83 (E6) highest of any G60 item |
| Performance / power | `Overall power and pickup`, `Acceleration from stop`, `Passing capability`, `Overall driving performance` | `Acceleration`, `Sportiness`, `Roadholding` | Both models strong on acceleration (top2 0.679/0.643); CN/EU sportiness splits: China likes it (8.6–8.9), EU G70 hates it (6.97, F46) |
| Controls / infotainment intuitiveness | `Intuitiveness of controls`, `Menu structure of infotainment system`, `Placement/ ease of reading and using controls`, `Ease of reading and using screen interface` | `Easy to read and use instruments/ controls/ displays`, `Easy to use information and entertainment system…` | Biggest G70 red flag: Intuitiveness top2 0.249, bottom2 0.119 (vs G60 0.422/0.022); menu structure worst-15 in both |
| Driver assistance | `Overall driver assist features`, `Adaptive driving assists…`, `Safety monitoring features`, `Backup system` | (no direct block; nearest `Safety` 8.17–9.28, `Connected services` 7.32–7.86) | G70 assist top2 0.526 > G60 0.460 but G70 bottom2 0.067 ≫ 0.010 (polarised) |
| Value for money | `Overall value for money`, `Price/deal offered`, `Affordable to buy`, `Future trade-in or resale value`, `Economical to own` | `Value for money` | Worst cluster in BOTH sheets: US G70 value cluster 0.063–0.271; CN/EU G70-EU 6.47 = lowest cell in that sheet (F18) |

[INFERRED] The PM's hypotheses are strongly supported by convergent evidence on **value-for-money (negative everywhere for G70-EU/US)** and **controls/infotainment intuitiveness (negative in US, soft in CN/EU)**; supported for **rear comfort (G70's defining strength in US)**; **HVAC/climate is an under-noticed consistent weak spot**; driver assistance is mixed/polarised.

## 7. Anomalies, missing data, suspicious values, synthetic-data signals [COMPUTED via E_03, in E_studies.json]

1. **No n anywhere** in either sheet — no significance testing possible. [OBSERVED]
2. **No formulas** in the workbook — all values pre-baked. [OBSERVED]
3. **CN/EU means carry 12–15 decimal places** (e.g. 8.7706445795833, B4). Real survey reports round to 1–2 dp; this precision suggests programmatic generation (synthetic data) or an unrounded pipeline export. [COMPUTED: precision analysis]
4. **US shares are exactly 3 dp** (plus float artifacts like 0.009000000000000001 from binary rounding) and **every block sums to precisely 1.000** — a hand-tabulated survey almost never sums perfectly 103×2 times. Another synthetic-data signal. [COMPUTED]
5. **G70 tail degradation pattern [COMPUTED]:** in the last ~53 blocks, G70's `I Hate It` mean share is 0.065 vs 0.021 in the first 50 blocks (max 0.179 at row 923, `Ease of customization`), with a matching `Unsatisfactory` bump and `Delightful` collapse (0.128 vs 0.194). The high-negative cells cluster at suspiciously round values (0.058, 0.065, 0.066, 0.078, 0.169, 0.179). [INFERRED] looks like a generated perturbation on the second half of the sheet — treat late-block G70 numbers cautiously. G60 shows no such drift (0.0104 → 0.0103).
6. **Blank rows 867 & 877** inside two US blocks; sheet dimension overshoots data (934 vs last content row 929; 13 vs 6 cols in CN_EU). Cosmetic. [OBSERVED]
7. **No mean exceeds a plausible scale max** (no mean > 10), and no US share is negative or >1. Scale bounds still unstated → cannot formally rule out. [COMPUTED] + [OPEN]
8. `Sample total = 1` for all 206 columns is a *share* total, not counts; `'If applicable:'` bases unknown. [OBSERVED]
9. No explicit "exterior colours" attribute exists in either sheet (closest: `Interior colors` US / `Exterior styling` CN-EU). [OBSERVED]
10. Missing values: none in any of the 1,633 raw value cells (185 CN/EU + 1,448 US level/share cells). Completeness itself is mildly unusual for real survey exports (non-response is common) — weak synthetic signal. [COMPUTED]

### Bottom line for the PM dashboard
Use within-sheet comparisons only. US story: G70 = rear-cabin + ride champion, affordability + controls/HMI liability; G60 = driving/dynamics + exterior, weaker back seat. CN/EU story: satisfaction is market-dependent (China loves G70: 9.64; EU-G70 lowest satisfaction 7.98 with value-for-money 6.47 at the floor); Connected services ≈7.3 everywhere. Study ratings are attitudinal evidence — keep them side-by-side with, never averaged into, the complaint-text themes from reports A–D.
