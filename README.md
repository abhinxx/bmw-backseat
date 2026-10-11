# BMW Backseat

**The PM drives. The customers and the AI take the backseat.**

Backseat is an evidence-led workspace for BMW product managers shaping a successor vehicle. It brings customer feedback, studies, sales and outside signals together, then turns them into customer-facing requirements with visible priority factors and a human decision trail.

[Open the live app](https://bmw-backseat.vercel.app) · [Architecture](ARCHITECTURE.md) · [Product brief](BMW_Product_Vision_PRD_Brief.md) · [Prompt design](docs/PROMPTS.md)

Built at the **[European Hackathon League Grand Finale](https://ehl.gg/apply/finale)** in Munich, 10-11 October 2026, for the BMW challenge. Partners: BMW Group, Entire, Tacto and Atira.

## From evidence to a decision

1. **Choose a vehicle and market.** Mission Control brings the selected car into focus: customer voices, study values, sales, explorable topics and the gap between where BMW sells and who its feedback represents.
2. **Explore a change.** In What-If Studio, describe a proposed change to the 5 Series. Nine behavioural segments return evidence-linked, explicitly simulated reactions. A repeated question reuses its stored answer when the evidence and method are unchanged.
3. **Check the outside world.** Research Agent searches competitors, reviews, owner communities and trends through Linkup. Each retained finding has a source and a quote checked against the returned page text.
4. **Create requirements.** Choose the optional evidence sources, with BMW internal data always included. Code identifies candidates and calculates priorities; the AI drafts the requirement, rationale, proposed target, assumptions and uncertainties.
5. **Review and share.** Inspect supporting and opposing evidence, edit the wording, challenge the case, override priority, or approve, reject and postpone with a reason. Download requirements as CSV/JSON, or export a What-If run as a PDF decision memo.

## Workspace

| Screen | What to expect |
|---|---|
| [Mission Control](https://bmw-backseat.vercel.app/) | Vehicle-centred overview, Problems / Wants / What works, evidence drawers, market comparison, outside voices and open requirements |
| [What-If Studio](https://bmw-backseat.vercel.app/what-if) | Cited reactions from nine 5 Series segments, confidence and coverage warnings, saved runs and PDF export |
| [Requirements](https://bmw-backseat.vercel.app/requirements) | Ranked proposals, factor breakdowns, evidence grades, assumptions, human review and a per-requirement audit trail |
| [Research Agent](https://bmw-backseat.vercel.app/research) | Live source-backed investigations and cited competitor tables for all three vehicle lines |
| [History](https://bmw-backseat.vercel.app/history) | Reopen saved What-If and Research runs; download PDFs already generated for simulations |
| [Workflow](https://bmw-backseat.vercel.app/workflow) | Evidence-to-requirements funnel and the boundaries between code, AI and the product manager |
| [Settings](https://bmw-backseat.vercel.app/settings) | Display name, personal OpenAI key/model for Requirements, live source counts, method, limits and integration status |
| Linked evidence records | Original comment, study cell, price-list entry or public finding behind a citation |

Vehicle coverage: **5 Series (G60), 7 Series (G70) and 1 Series (F70)**. Market views: **all markets, Europe, United States and China**. Persona simulation is intentionally **5 Series only**. Requirement scores use vehicle-wide evidence; the market picker filters the list by where a signal exists rather than recalculating scores.

## Evidence behind the workspace

The internal BMW snapshot is loaded into Supabase. Public evidence and saved investigations sit alongside it, without rewriting the supplied BMW records.

| Dataset | Contents |
|---|---|
| Customer feedback | 10,128 unique comments across three cars; 13,771 taxonomy-label rows, retaining country, engine and source |
| Customer studies | 3,275 values with market, model, attribute and original workbook cell |
| Equipment and price lists | 431 equipment items and 23 variants from the German July 2026 price lists |
| Sales volumes | 36 rows covering EU, China, US and rest of world; 2024/2025 values and the supplied 2030 forecast |
| Behavioural segments | Nine G60 profiles with evidence references, behaviour rules, coverage gaps and falsification criteria |
| Public evidence | BMW annual-report facts, industry studies, owner quotes, rival comparisons and Google Trends |
| App-generated records | What-If runs, research findings, requirement versions, decision events and PDF exports |

**Trust is part of the interface.** Observed, Calculated, Inferred, Simulated and External labels distinguish source data from interpretation. Counts and requirement scores come from code, not the model. Simulation verdicts are not customer votes; proposed targets are forward-looking assumptions, not observed results.

Every requirement separates its calculated score from its evidence grade and any PM priority override. Reruns preserve human-edited wording and decisions. State changes and their audit events commit together; a stale edit must be refreshed rather than silently overwriting another change.

## Reading the evidence responsibly

- One comment can have several taxonomy labels. The app distinguishes unique comments from label rows; a comment may still appear in several themes.
- Internal feedback is US-heavy, has no dates or demographics, and contains no China or Germany comments. External owner accounts do not turn it into a representative global survey.
- Studies have no sample sizes. Some means have unusual precision, and the supplied scale is not stated. They are shown as source values, not a score out of ten.
- Some feedback appears templated or partly generated. Equipment data is a German July 2026 snapshot, not a worldwide successor specification.
- Persona ages, jobs and locations are illustrative. Vehicle imagery and the development timeline are illustrations, not confirmed successor designs or programme dates.

## Prototype boundaries

This is a **shared workspace without authentication**. Display names are recorded as “not signed in”; they are not verified identities. Personal OpenAI keys stay in that browser's local storage and are sent only with Requirements drafting/challenge requests. What-If, Research and PDF generation use the server's team keys.

CSV uploads are **unverified context**, capped at 300 rows and 500 KB. They are snapshotted with a requirements run, never imported into BMW tables and never counted in scores. Codebeamer export is a real tracker-item **payload preview only**: its connection is disabled and nothing is sent. CSV/JSON can include proposals as well as approved requirements, preserving decision status.

## Technology

**Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui and Radix UI · Supabase PostgreSQL/Storage · OpenAI · Linkup · Vercel**

Next.js server components render database-backed screens; client components handle interactive controls. Server routes handle AI calls and writes. PDF generation runs in Node.js with `@react-pdf/renderer`; it does not require Python in production.

## Run your own instance

Use Node.js 24 and npm, matching the deployed Node.js runtime. Database management also requires the Supabase CLI; the key-sync script requires an authenticated Vercel CLI linked to your project.

```bash
git clone https://github.com/abhinxx/bmw-backseat.git
cd bmw-backseat
npm ci
```

Create an untracked `.env.local` with your own credentials:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
LINKUP_API_KEY=your_linkup_api_key
```

Only the two `NEXT_PUBLIC_` Supabase values are public. The service-role and provider keys must remain server-side. Never commit credentials.

**Database prerequisite:** connect to a populated Supabase project, or apply `supabase/migrations/` to your own project and provide the local datasets expected by the loader scripts. Raw BMW files and extracted research datasets are deliberately excluded from the current source tree; cloning the app is not a complete data setup.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
npm run dev
```

Open `http://localhost:3000`. For a production build, use `npm run build` and `npm start`.

### Data loading

With the private input files available, the team uses:

```bash
npm run data:feedback
npm run data:load
npm run data:external
```

Feedback ingestion creates one record per comment and rebuilds the original spreadsheet rows to check that no source cell was lost. The loaders populate the internal snapshot and curated public evidence separately.

### Deploy to Vercel

Import the GitHub repository into Vercel and configure the environment variables above. This project's functions run in Frankfurt (`fra1`, in `vercel.json`). Pushes to `main` deploy production; other branches can receive Vercel preview deployments.

`npm run env:push` synchronizes **only `OPENAI_API_KEY` and `LINKUP_API_KEY`** from a trusted local `.env.local` into the linked Vercel project. Production and preview values are marked sensitive; development values use the CLI's development setting. Configure the Supabase variables separately. New server environment values require a new deployment to take effect.

Settings does **not** modify Vercel environment variables. A personal Requirements key takes effect on the next request, without a deployment.

## Repository guide

| Path | Responsibility |
|---|---|
| `app/` | Pages and server API routes |
| `components/` | Workspace shell, Mission Control, evidence views and feature controls |
| `lib/` | Database reads, retrieval, simulation, research and scope helpers |
| `lib/requirements/` | Candidate signals, scoring, grounded drafting, decisions, CSV handling and export payloads |
| `lib/deck/` | Stored-run payload, validated copy, cover generation and PDF rendering |
| `supabase/migrations/` | Tables, read policies, evidence queries and atomic audit/budget functions |
| `personas/` | G60 behavioural profiles and illustrations |
| `scripts/` | Offline ingestion, data loading and provider-key synchronization |
| `docs/` | Prompt design and PDF-export design notes |
| `BMW-Data/`, `research/`, `data/` | Local, gitignored source files and processing outputs |

## Development provenance

Historical commits before `aeea164` still contain research artifacts. Removing data from the current tree does not remove it from Git history.

Agent sessions are captured with [Entire](https://docs.entire.io) in `.entire/`. The repository also includes project instructions for coding agents. The live application's retrieval and decision logic is TypeScript code, not the development agent harness.

For system boundaries, database records, request flows and operational constraints, see [ARCHITECTURE.md](ARCHITECTURE.md).
