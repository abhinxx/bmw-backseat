import { ArrowRight, MessageSquareText } from "lucide-react"
import Link from "next/link"

import { EmptyState, PageHeader } from "@/components/page"
import { CoverageWarning, Provenance, type ProvenanceKind } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarketContext } from "@/components/dashboard/market-context"
import { ThemeChart, topThemeBars } from "@/components/dashboard/theme-chart"
import { OutsideView } from "@/components/outside-view"
import { WhatChanged } from "@/components/what-changed"
import { countOutside, countRuns, missionControl, outsideView, type Bucket } from "@/lib/data"
import { SUGGESTED_WHAT_IFS } from "@/lib/nav"
import { marketOf, vehicleOf } from "@/lib/scope"

const n = (x: number) => x.toLocaleString("en-US")
const k = (x: number) => (x >= 1000 ? `${Math.round(x / 1000)}k` : n(x))
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const sum = (r: Record<Bucket, number>) => Object.values(r).reduce((a, b) => a + b, 0)

type Tile = { label: string; kind: ProvenanceKind; value: string; note: string; warn?: string }

// Verified in the data audit (README, research/D_feedback_audit.md). Becomes a database query in M3.
const BLIND_SPOTS = [
  "No customer feedback from China or Germany. China appears only in the survey and sales.",
  "No demographics: no age, gender, income or family. Segments are behavioural.",
  "Feedback has no dates, so trends over time cannot be shown.",
  "Feedback outside the US comes from a single source.",
]

export default async function MissionControl({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string }>
}) {
  const { v, m } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)
  const scope = `v=${vehicle.id}&m=${market.id}`
  const [d, outside, runs, evidence] = await Promise.all([
    missionControl(vehicle.id, market.id),
    outsideView(vehicle.id, market.id),
    countRuns(vehicle.id),
    countOutside(vehicle.id),
  ])

  const one = market.id !== "all" ? (market.id as Bucket) : null
  const sales25 = one ? d.sales2025[one] : sum(d.sales2025)
  const sales30 = one ? d.sales2030[one] : sum(d.sales2030)
  const fbTotal = sum(d.feedbackBy)
  const fbHere = one ? d.feedbackBy[one] : fbTotal
  const sat = d.satisfaction.find((s) => s.market === (one === "CN" ? "CN" : "EU"))
  const satOther = d.satisfaction.filter((s) => s !== sat)

  const tiles: Tile[] = [
    {
      label: "Comments analysed",
      kind: "calculated",
      value: n(fbHere),
      note: one ? `${pct(fbHere, fbTotal)}% of all ${vehicle.name} feedback` : "Unique comments, not label rows",
      warn: !one && pct(d.feedbackBy.US, fbTotal) > 80 ? `${pct(d.feedbackBy.US, fbTotal)}% from the US` : fbHere === 0 ? "No feedback here" : undefined,
    },
    {
      label: `Satisfaction${sat ? ` · ${sat.market === "EU" ? "Europe" : "China"}` : ""}`,
      kind: "observed",
      value: sat ? sat.value.toFixed(1) : "—",
      note: sat
        ? `Study mean, scale not stated${satOther.length ? ` · China ${satOther[0].value.toFixed(1)}` : ""}`
        : "No overall score for this market in the study",
    },
    {
      label: "What-if runs",
      kind: "calculated",
      value: n(runs),
      note: `Saved simulations for the ${vehicle.name}`,
    },
    {
      label: "Outside evidence",
      kind: "external",
      value: n(evidence),
      note: "Report facts, owner quotes, rivals, research",
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name}`}
        title="Mission Control"
        description={`What customers value today and what the ${vehicle.name} successor should offer. Every number says where it came from.`}
        action={
          <Button asChild size="lg" className="rounded-full px-5">
            <Link href={`/what-if?${scope}`}>
              Ask a what-if <ArrowRight />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="gap-3">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardDescription className="whitespace-nowrap">{t.label}</CardDescription>
              <Provenance kind={t.kind} />
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.note}</p>
              {t.warn && <CoverageWarning>{t.warn}</CoverageWarning>}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>What customers talk about</CardTitle>
            <CardDescription>
              Top BMW taxonomy themes by total comments{one ? ` in ${market.name}` : ""} — likes, problems and wants in one bar.
            </CardDescription>
          </div>
          <Provenance kind="calculated" />
        </CardHeader>
        <CardContent>
          {d.themes.length === 0 ? (
            <EmptyState icon={MessageSquareText} title={`No feedback for ${market.name}`}>
              BMW&apos;s feedback has no comments from this market. See blind spots.
            </EmptyState>
          ) : (
            <ThemeChart bars={topThemeBars(d.themes)} />
          )}
        </CardContent>
      </Card>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
            <CardDescription>New research findings matched to a feature, and the latest what-ifs.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhatChanged vehicle={vehicle.id} scope={scope} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Try a what-if</CardTitle>
            <CardDescription>Suggested from the top themes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {SUGGESTED_WHAT_IFS.map((q) => (
              <Link
                key={q}
                href={`/what-if?${scope}&q=${encodeURIComponent(q)}`}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                {q}
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <OutsideView data={outside} vehicleId={vehicle.id} vehicleName={vehicle.name} marketId={market.id} />

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Blind spots</CardTitle>
            <CardDescription>What this data cannot tell us.</CardDescription>
          </div>
          <Provenance kind="observed" />
        </CardHeader>
        <CardContent>
          <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {BLIND_SPOTS.map((b) => (
              <li key={b} className="flex gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-inferred" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <MarketContext
        marketName={market.name}
        salesHere={sales25}
        forecastHere={sales30}
        soldHere={sales25 > 0}
        sales2025={d.sales2025}
        feedbackBy={d.feedbackBy}
      />

      {/* DevTimeline: placed by orchestrator */}
    </>
  )
}
