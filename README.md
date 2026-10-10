# BMW Backseat

Evidence-led product intelligence console for BMW product managers. The PM picks a vehicle, proposes a feature change, and sees how evidence-backed customer segments might react - every claim traceable to its source. The PM drives; the customers take the backseat.

Built at the **[European Hackathon League](https://ehl.gg) Grand Finale**, Munich, 10-11 October 2026 ([event](https://ehl.gg/apply/finale) · [rules](https://ehl.gg/rules) · [partners](https://ehl.gg/partners)), BMW challenge. Partners: [BMW Group](https://www.bmwgroup.com), [Entire](https://entire.io), Tacto, Atira.

## The problem

BMW PMs decide on features years before a car ships. The evidence (customer feedback, studies, usage, sales, competitors, online signals) is scattered, synthesised by hand in Excel and PowerPoint, and hard to trace. Backseat turns it into one visual, explorable decision environment: internal evidence first, curated external signals second, fact and inference always separated, "insufficient evidence" when that is the honest answer.

## Done so far

Research on the BMW datasets (kept local, not in this repo):

| Dataset | What it holds |
|---|---|
| Feedback workbooks G60 (5 Series), G70 (7 Series), F70 (1 Series) | 10,128 unique customer comments (13,771 rows; one row per category) with BMW taxonomy, country, engine, source |
| Customer studies | Survey scores: US (G60, G70), China (G68, G70), EU (F70, G60, G70) - reshaped to one long table |
| Option lists | 431 equipment items, 23 engine variants, prices and option codes extracted from the German July 2026 price lists |
| Sales volumes | EU / CN / US / RoW for 2024, 2025, 2030 forecast |
| PM interview | Current workflow, pain points, what a PM wants from the tool |

Personas (`personas/`, in this repo): 9 evidence-backed G60 behavioural personas (3 each for Americas, Europe, Asia) as JSON with evidence tier, cited quotes and falsification criteria, plus avatar SVGs. Age, job and location in `identity_illustration` are labelled illustration only - the data has no demographics.

Key findings:

- **No demographics** in the data (no age, gender, income, family) - customer segments must be behavioural, e.g. "frustrated by controls".
- **Coverage gap:** G60/G70 feedback is ~92% US, while Europe is the largest sales market. No China or Germany in feedback; China only in survey and sales.
- **#1 complaint (G60, G70): digital controls** (iDrive, touchscreen, CarPlay, My BMW App). The US survey confirms it independently.
- **Demo case - rear seat heating:** standard on G70, a EUR 2,750 option on G60; G70 wins US 2nd-row comfort 73.6% vs 47.1% top-2-box.

## Next

1. One cleaned feedback dataset (one record per comment).
2. External research: competitors, press, Reddit, NHTSA.
3. The console app.

## Setup

- Agent sessions are captured with [Entire](https://docs.entire.io) (`.entire/`).
- Raw BMW data (`BMW-Data/`) and research outputs (`research/`) are not public; cleaned datasets will be added when ready.
