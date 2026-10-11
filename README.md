# BMW Backseat

Evidence-led product intelligence console for BMW product managers. The PM picks a vehicle, proposes a feature change, and sees how evidence-backed customer segments might react - every claim traceable to its source. The PM drives; the customers take the backseat.

**Live:** https://bmw-backseat.vercel.app (every push to `main` deploys to production; there is no separate local or staging setup).

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

## Data caveats

- One feedback comment can span several rows (one per category label). Always count comments, never rows.
- Feedback has no dates. Non-US feedback comes from one source only; sources B, C and D are US-only.
- Survey China/EU means have unusual precision and US blocks sum to exactly 100% (possibly generated data); no sample sizes.
- Price lists are German, July 2026, and newer than the cars in the feedback (e.g. the G70 already has Panoramic iDrive).
- The feedback contains signs of templated or partly generated text; treat provenance as unverified.

## Repository layout

| Path | In git | What |
|---|---|---|
| `README.md` | yes | This file |
| `BMW_Product_Vision_PRD_Brief.md` | yes | Product vision brief |
| `app/`, `components/`, `lib/` | yes | Next.js 16 app (shadcn/ui). `lib/data.ts` is the only place that reads the database |
| `supabase/migrations/` | yes | Database schema, applied to production with `supabase db push` |
| `personas/` | yes | G60 persona JSONs and avatar SVGs |
| `scripts/` | yes | Data cleaning (`npm run data:feedback`) and loading into Supabase |
| `BMW-Data/` | no | Raw BMW files, including the official challenge brief |
| `research/` | no | Research reports, extracted data (survey, option lists, aggregates), legacy Python scripts |
| `data/` | no | Cleaned output from `scripts/`, loaded into the database |
| `.entire/`, `.claude/` | yes | Entire session capture and Claude Code settings |

## Data cleaning

```
npm install
npm run data:feedback   # BMW-Data feedback xlsx -> data/clean/feedback_comments.json
```

Produces one record per comment (10,128) with its category labels as a list; sentiment is kept per label because one comment can be both a "Like" and a "Difficult to Use". The script rebuilds every original spreadsheet row from the cleaned data and refuses to write output if any cell differs.

## Milestones

| | What | Status |
|---|---|---|
| M1 | Next.js + shadcn/ui on Vercel, auto-deploy from `main` | done |
| M2 | App shell: sidebar, vehicle/market pickers, ⌘K, light/dark, provenance chips, 5 screens | done |
| M3 | Internal BMW data in Supabase (read-only, every row points back to its source cell/row/page); Mission Control on real numbers | in progress |
| M4 | Feature ↔ evidence map; What-If with stored, cited persona verdicts; History as audit log | next |
| M5 | Requirements board (approve / reject / edit / challenge, logged) | |
| M6 | Research Agent (Linkup) | |

Grounding rules: the database does all counting; AI only sees rows selected by a fixed query, must cite their IDs, and the server rejects any ID or quote that is not in that set.

## Setup

- Agent sessions are captured with [Entire](https://docs.entire.io) (`.entire/`).
- Raw BMW data and research outputs are not public. Older commits (before `aeea164`) still contain `research/`.
