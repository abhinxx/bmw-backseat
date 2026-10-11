import { Activity, ArrowRight, MessageSquareText } from "lucide-react"
import Link from "next/link"

import { EmptyState, PageHeader } from "@/components/page"
import { Provenance, type ProvenanceKind } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SUGGESTED_WHAT_IFS } from "@/lib/nav"
import { marketOf, vehicleOf } from "@/lib/scope"

const TILES: { label: string; kind: ProvenanceKind; note: string }[] = [
  { label: "Sales 2025 → 2030", kind: "observed", note: "BMW sales volumes by market" },
  { label: "Customer comments", kind: "calculated", note: "Unique comments, not rows" },
  { label: "Satisfaction", kind: "observed", note: "Customer study, top-2-box" },
  { label: "Open requirements", kind: "calculated", note: "Proposed or in review" },
]

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
        {TILES.map((t) => (
          <Card key={t.label} className="gap-3">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardDescription className="whitespace-nowrap">{t.label}</CardDescription>
              <Provenance kind={t.kind} />
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold tracking-tight text-muted-foreground/50">—</p>
              <p className="text-xs text-muted-foreground">{t.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>What customers talk about</CardTitle>
              <CardDescription>Top themes by Likes, Problems and Wants, from BMW&apos;s own taxonomy.</CardDescription>
            </div>
            <Provenance kind="inferred" />
          </CardHeader>
          <CardContent>
            <EmptyState icon={MessageSquareText} title="Themes appear once feedback is loaded">
              Counts come from the database. AI explains and proposes; it never counts.
            </EmptyState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Blind spots</CardTitle>
              <CardDescription>What this data cannot tell us.</CardDescription>
            </div>
            <Provenance kind="observed" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {BLIND_SPOTS.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-inferred" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
            <CardDescription>New research findings, simulations and decisions since your last visit.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Activity} title="Nothing yet">
              Every what-if, research run and decision will show up here.
            </EmptyState>
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
    </>
  )
}
