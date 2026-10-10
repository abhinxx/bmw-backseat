# F: BMW price lists (option lists) — structured extraction

Source: `BMW-Data/F70_OptionList.PDF` (23 pp), `G60_OptionList.PDF` (28 pp), `G70_OptionList.PDF` (27 pp).
All three are **BMW Germany price lists dated JULI 2026**, prices in EUR incl. 19% VAT (net in brackets).
Done by the parent agent (the F subagent was killed before producing output; its raw text dumps were reused only
for page mapping; its extraction script never worked and was not used).

Scripts: `research/scripts/F_parse_pricelists.py` (parser), `F_check_visual.py` (regression check),
`F_summary.py` (focus-feature table). Rerun in that order with `.venv/bin/python`.

## 1. What was extracted

| Output | Content |
|---|---|
| `research/data/F_variants.json` | 23 variants: fuel type, kW/PS, base price (F70 6, G60 10, G70 7) |
| `research/data/F_items.json` | 431 items: 160 standard-equipment + 210 options + 61 conditional price lines (e.g. "In Verbindung mit M Sportpaket"), each with page, section, code, price, per-variant marks, constraints, description |
| `research/data/F_options.csv` | same items flattened: one row per (item, variant), 2,139 rows |
| `research/data/F_packages.json` | 10 package pages (M Sport Design / M Sportpaket / Pro / M-model pages) with price lines and contents |
| `research/data/F_focus_features.md/.json` | per-model status of the features the PM questions are about |
| `research/data/F_parse_log.json` | per-page result: 22 option grids, 10 standard grids, 10 package, 5 price pages parsed; 31 not parsed (covers, contents, technical data, dimension drawings, legal text) |

Items per model (base items, excl. conditional lines): F70 39 standard / 57 options; G60 48 / 64; G70 73 / 89.

## 2. How it was verified

Pages were rendered to images and read by eye; 42 values (codes, prices, per-variant marks, conditions, variant
power and prices) are hard-coded in `F_check_visual.py`. Current result: **42/42 pass** (G60 p5/p6/p15/p18,
G70 p4/p21, F70 p14/p17). Parser bugs found this way and fixed: price row printed 2pt above its label, fake-bold
codes printed twice (`C31` read as `CC3311`), heading and its ■ mark on different baselines, footnotes leaking into
the last item, priced bullet lines read as item names.

## 3. Variants and base prices (Germany, gross EUR)

| Model | Variant | Fuel | kW (PS) | Base price |
|---|---|---|---|---|
| F70 | 116 / 120 / 123 xDrive / M135 xDrive | petrol | 90 (122) / 125 (170) / 160 (218) / 221 (300) | 34,250 / 39,150 / 45,350 / 57,150 |
| F70 | 118d / 120d | diesel | 110 (150) / 120 (163) | 39,350 / 41,750 |
| G60 | i5 eDrive40 / i5 xDrive40 / i5 M60 xDrive | electric | 250 (340) / 290 (394) / 442 (601) | 70,900 / 76,300 / 100,200 |
| G60 | 530e / 530e xDrive / 550e xDrive | plug-in hybrid | 220 (299) / 220 (299) / 360 (489) | 66,700 / 69,300 / 78,700 |
| G60 | 520i | petrol | 153 (208) | 60,000 |
| G60 | 520d / 520d xDrive / 540d xDrive | diesel | 145 (197) / 145 (197) / 223 (303) | 62,300 / 64,900 / 71,900 |
| G70 | i7 50xDrive / i7 60xDrive / i7 M70 xDrive | electric | 335 (455) / 400 (544) / 500 (680) | 121,400 / 140,100 / 182,400 |
| G70 | 750e xDrive / M760e xDrive | plug-in hybrid | 360 (489) / 450 (612) | 133,900 / 159,900 |
| G70 | 740 xDrive | petrol | 294 (400) | 117,900 |
| G70 | 740d xDrive | diesel | 230 (313) | 122,900 |

## 4. Focus features per model

See `research/data/F_focus_features.md` (generated, with page + option-code references). Headlines:

- **Rear seat heating: standard on G70, a €2,750 Comfort Paket item on G60 (7VB, bundled with front seat
  ventilation and 4-zone climate), not listed for F70.** Front seat heating is standard on all three. This is the
  PM interview's own example ("seat heating in the back ... optional here, standard one class higher").
- **Rear comfort is a G70-only world:** Executive Paket €4,450 (rear ventilation, rear multifunction seats, rear
  massage, Executive Lounge console), Executive Lounge Paket €7,450 (Lounge Seating, "Fond-Entertainment Experience",
  requires Executive + Connoisseur Paket), Executive Lounge Seating alone €2,200.
- **Heated steering wheel:** option on F70 (€250) and G60 (€350), standard on G70.
- **Head-up display:** G70 standard; F70/G60 only inside the Innovationspaket (€3,800 / €2,400).
- **Driver assistance:** Driving Assistant Plus is an option on F70 (€700) / G60 (€1,000), standard on G70.
  Top tier: DA Professional option on F70 (€2,280) / G60 (€2,100); on G70 sold as "Autobahn- & City-Assistent"
  (5BB, €1,980, time-limited subscription).
- **Exterior colours (G60):** Alpinweiß standard; 9 metallics €1,120; BMW Individual €2,140-5,900; some only with
  M Sportpaket (e.g. Fire Red C68). F70: Schwarz uni standard (not with M Sportpaket), metallics €780.
- **Digital cockpit generations differ:** G60 = BMW Live Cockpit Plus with **Operating System 8.5**; F70 =
  **Operating System 9**; G70 (July 2026) = **BMW Panoramic iDrive with Operating System X**, plus BMW Passenger
  Screen and BMW Touch Command as standard.

## 5. Caveats (read before using in the product)

- **Market = Germany.** Prices and standard/optional status are German-market facts. The feedback data is 90-95% US
  for G60/G70 and has no German records; US/China equipment can differ.
- **Model year mismatch is likely.** A July 2026 G70 with Panoramic iDrive / OS X is a newer specification than the
  OS 8.5-era cars most owners in the feedback describe [INFERRED: feedback has no dates]. Complaints about the old
  iDrive may already be addressed by the 2026 car; this must be shown, not hidden.
- **"Not listed" is not "not available".** Standard pages are titled "AUSGEWÄHLTE SERIENAUSSTATTUNGEN" (selected).
- **G70 plug-in hybrids (750e, M760e) and 740d are on the price pages but not in the equipment grids** (grids show
  4 columns: i7 50xDrive, i7 60xDrive, 740 xDrive, i7 M70 xDrive). Verified visually on p21. The 740d xDrive is
  footnoted "Voraussichtlich verfügbar ab November" (expected from November, data provisional).
- Variant tables cross-checked against the independent raw text dump (`F_raw_*.txt`): all 23 variants match.
- "Theatre Screen" does not appear by that name; "Fond-Entertainment Experience" in the Executive Lounge Paket is
  the likely equivalent [INFERRED].
- Not parsed: technical data pages (dimensions, consumption), interior-colour descriptions beyond name/code/price.
  Constraint lines that wrap onto a second line keep only the first line.
