import { connection } from "next/server"

import { PageHeader } from "@/components/page"
import { AiForm } from "@/components/settings/ai-form"
import { StatusChip } from "@/components/settings/chip"
import { ModelPerJob } from "@/components/settings/model-per-job"
import { NameForm } from "@/components/settings/name-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DEFAULT_WEIGHTS,
  EVIDENCE_LEVELS,
  FACTORS,
  LIMITS,
  PRIORITY_RULE,
  SCORE_VERSION,
  SOURCE_HIERARCHY,
} from "@/lib/requirements/config"
import type { FactorId } from "@/lib/requirements/types"
import { dataSources, type DataTable } from "@/lib/settings-data"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const n = (x: number) => x.toLocaleString("en-US")

const ANCHORS = [
  { id: "you", label: "You" },
  { id: "ai", label: "AI provider" },
  { id: "search", label: "Search providers" },
  { id: "data", label: "Data sources" },
  { id: "method", label: "Method" },
  { id: "integrations", label: "Integrations" },
]

// Counted tables per source-hierarchy tier (simulation_verdict and CSV rows are not counted here).
const TIER_TABLES: Record<number, DataTable[]> = {
  1: ["feedback_comment", "feedback_label", "study_metric", "option_item", "vehicle_variant", "sales_volume", "persona"],
  2: ["external_finding"],
  3: ["research_finding"],
}
const GENERATED: DataTable[] = ["research_run", "simulation_run", "requirement", "requirement_event"]

export default async function Settings() {
  await connection() // read the database on every request, never prerendered
  const counts = await dataSources()
  const linkupReady = Boolean(process.env.LINKUP_API_KEY)

  return (
    <>
      <PageHeader
        eyebrow="Workspace · no login in this prototype"
        title="Settings"
        description="Your name, your AI key, the data and the rules behind every result. Nothing here is hidden in code."
      />
      <nav className="flex flex-wrap gap-x-4 gap-y-1 pb-6 text-xs text-muted-foreground">
        {ANCHORS.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="hover:text-foreground hover:underline">
            {a.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-6">
        <Card id="you">
          <CardHeader>
            <CardTitle>You</CardTitle>
          </CardHeader>
          <CardContent>
            <NameForm />
          </CardContent>
        </Card>

        <Card id="ai">
          <CardHeader>
            <CardTitle>AI provider</CardTitle>
            <CardDescription>Run Requirements drafting on your own OpenAI key if the team key runs out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <AiForm />
            <ModelPerJob />
          </CardContent>
        </Card>

        <Card id="search">
          <CardHeader>
            <CardTitle>Search providers</CardTitle>
            <CardDescription>Where the Research Agent and evidence lookups get live pages.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <SearchRow
              name="Linkup"
              connected={linkupReady}
              status={linkupReady ? "Connected · team key" : "Not connected"}
              note="Web, press, Reddit and owner forums; returns page text so every quote can be checked"
            />
            <SearchRow name="Exa" connected={false} status="Available · not connected" note="Owner forums, similar pages" />
            <SearchRow name="Reddit API" connected={false} status="Available · not connected" note="Real Reddit threads and comments" />
            <SearchRow name="NHTSA" connected={false} status="Available · not connected" note="US recalls and complaints, official" />
            <SearchRow name="Tavily / Firecrawl" connected={false} status="Available · not connected" note="Broad web, page scraping" />
          </CardContent>
        </Card>

        <Card id="data">
          <CardHeader>
            <CardTitle>Data sources</CardTitle>
            <CardDescription>Live row counts from the database, grouped by the source hierarchy (higher tiers win when sources disagree).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {SOURCE_HIERARCHY.map((tier) => {
              const tables = TIER_TABLES[tier.tier] ?? []
              return (
                <div key={tier.tier} className="space-y-2">
                  <p className="text-sm font-medium">
                    Tier {tier.tier} · {tier.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{tier.detail}</p>
                  {tables.length > 0 ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {tables.map((t) => (
                        <li key={t} className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
                          <span className="font-mono text-xs">{t}</span>
                          <span className={cn("tabular-nums", counts[t] === null && "text-muted-foreground")}>
                            {counts[t] === null ? "not available yet" : n(counts[t])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No counted table for this tier.</p>
                  )}
                </div>
              )
            })}
            <div className="space-y-2">
              <p className="text-sm font-medium">Generated by the app (append-only)</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {GENERATED.map((t) => (
                  <li key={t} className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
                    <span className="font-mono text-xs">{t}</span>
                    <span className={cn("tabular-nums", counts[t] === null && "text-muted-foreground")}>
                      {counts[t] === null ? "not available yet" : n(counts[t])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Future connectors (not connected)</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>BMW usage-data hub — How many people sit in the back, per vehicle</li>
                <li>Welcome-call studies — Post-purchase survey after 3 months</li>
                <li>Press monitoring agency</li>
                <li>Dealer feedback</li>
                <li>Codebeamer — Engineering requirements; see Integrations</li>
              </ul>
            </div>
            <p className="max-w-2xl text-xs text-muted-foreground">
              BMW data is a fixed snapshot loaded once and never edited (11 Oct 2026). CSV uploads in Requirements are
              sent to the AI as context only and stored with the run, not loaded into these tables.
            </p>
          </CardContent>
        </Card>

        <Card id="method">
          <CardHeader>
            <CardTitle>Method and constraints</CardTitle>
            <CardDescription>The rules every run follows, shown as they are in code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <p className="text-sm font-medium">Grounding rules</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
                <li>The database selects the evidence, the same way every time for the same question.</li>
                <li>The model sees only that evidence; each item has an ID.</li>
                <li>The model must cite IDs. The server drops any ID that was not given and logs it as rejected.</li>
                <li>Too little evidence means &apos;Not enough evidence&apos; without asking the model.</li>
                <li>Same question and same evidence return the stored answer.</li>
                <li>Every number on a dashboard or score comes from the database, never from the AI.</li>
              </ol>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Requirement score</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Factor</th>
                      <th className="px-3 py-2 font-medium">Definition</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 text-right font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(FACTORS) as FactorId[]).map((f) => (
                      <tr key={f} className="border-b border-border last:border-b-0 align-top">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{FACTORS[f].label}</td>
                        <td className="min-w-64 px-3 py-2 text-xs text-muted-foreground">{FACTORS[f].definition}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{FACTORS[f].source}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{DEFAULT_WEIGHTS[f]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="max-w-2xl text-xs text-muted-foreground">
                Score = weighted average of the factors that apply, 0-100. Factors switched off or not applicable are
                left out and the weights re-normalised.
              </p>
              <ul className="space-y-1 text-sm">
                {PRIORITY_RULE.map((p) => (
                  <li key={p.priority} className="flex gap-3">
                    <span className="w-24 shrink-0 font-mono text-xs">{p.priority} ≥ {p.min}</span>
                    <span className="text-muted-foreground">{p.label}</span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-1 text-sm">
                {(Object.keys(EVIDENCE_LEVELS) as (keyof typeof EVIDENCE_LEVELS)[]).map((g) => (
                  <li key={g} className="flex gap-3">
                    <span className="w-24 shrink-0 font-mono text-xs">{g}</span>
                    <span className="text-muted-foreground">{EVIDENCE_LEVELS[g]}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Scoring version: <span className="font-mono">{SCORE_VERSION}</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Limits</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>What-If: fewer than 3 comments and no study data → Not enough evidence; minimum 5 words per question.</li>
                <li>Research: 1 / 3 / 4 searches for quick / standard / deep, 5 results per search, at most 15 pages read, quotes checked word for word.</li>
                <li>
                  CSV upload: {LIMITS.csvMaxRows} rows, {LIMITS.csvMaxBytes / 1000} KB, {LIMITS.csvRowsPerRequirement} rows
                  given per requirement, never counted in scores.
                </li>
                <li>Decisions: a reason of at least {LIMITS.reasonMinChars} characters is required.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card id="integrations">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Where approved requirements and decisions can leave the tool.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Codebeamer</p>
                  <p className="max-w-2xl text-xs text-muted-foreground">
                    Push approved requirements to the engineering tracker (PTC Codebeamer REST API v3, POST
                    /api/v3/trackers/&#123;trackerId&#125;/items). Needs your BMW Codebeamer URL, a tracker ID and an API
                    token; not available in this prototype.
                  </p>
                </div>
                <StatusChip connected={false}>Not connected</StatusChip>
              </div>
              <div className="grid max-w-lg gap-3">
                <Input disabled placeholder="https://codebeamer.bmwgroup.net" aria-label="Codebeamer URL" />
                <Input disabled placeholder="Tracker ID" aria-label="Tracker ID" />
                <Input disabled type="password" placeholder="API token" aria-label="API token" />
              </div>
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground opacity-50"
                      >
                        Connect
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Requires access to the BMW network</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <SearchRow name="PDF decision memo" connected status="Available" note="One-page memo per What-If run" />
            <SearchRow name="CSV / JSON export" connected status="Available" note="Requirements list, in Requirements → Export" />
            <SearchRow name="Supabase" connected status="Connected" note="Postgres, Frankfurt" />
            <SearchRow name="Vercel" connected status="Connected" note="Hosting, Frankfurt" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function SearchRow({ name, connected, status, note }: { name: string; connected: boolean; status: string; note: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <StatusChip connected={connected}>{status}</StatusChip>
    </div>
  )
}
