import Image from "next/image"
import Link from "next/link"

import { PageHeader } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SUGGESTED_WHAT_IFS } from "@/lib/nav"
import { EVIDENCE_LIGHT, PERSONAS, REGIONS } from "@/lib/personas"
import { marketOf, vehicleOf } from "@/lib/scope"

// Fixed verdict scale (PLAN §4.3). Same question + same evidence = same answer.
const VERDICTS = [
  "More likely to buy",
  "Slightly more likely",
  "No effect",
  "Slightly less likely",
  "Less likely to buy",
  "Not enough evidence",
]

export default async function WhatIf({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string; q?: string }>
}) {
  const { v, m, q } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)
  const scope = `v=${vehicle.id}&m=${market.id}`

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name}`}
        title="What-If Studio"
        description="Propose a change. Each customer segment reacts on a fixed scale, with the evidence for and against."
      />

      <Card>
        <CardContent className="space-y-4">
          <Textarea
            key={q}
            defaultValue={q}
            placeholder={`Describe a change, e.g. "Make rear-seat heating standard on the next ${vehicle.name}"`}
            className="min-h-24 resize-none border-0 bg-muted/60 text-base shadow-none focus-visible:ring-2"
          />
          <div className="flex flex-wrap items-center gap-2">
            {SUGGESTED_WHAT_IFS.map((s) => (
              <Link
                key={s}
                href={`/what-if?${scope}&q=${encodeURIComponent(s)}`}
                className="rounded-full bg-secondary px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                {s}
              </Link>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto">
                  <Button size="lg" className="rounded-full px-6" disabled>
                    Simulate
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Not connected yet</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Customer segments</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {VERDICTS.map((v) => (
            <span key={v} className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {v}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Nine behavioural segments for the 5 Series, built from feedback, the customer study and sales. Names and
        faces are illustration only.
      </p>

      <div className="mt-5 space-y-6">
        {REGIONS.map((region) => (
          <section key={region}>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">{region}</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {PERSONAS.filter((p) => p.region === region).map((p) => (
                <Card key={p.id} className="gap-4">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Image
                      src={p.avatar}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      className="size-11 rounded-full bg-muted"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <CardTitle className="truncate text-[15px]">{p.label}</CardTitle>
                      <CardDescription className="truncate">
                        {p.name} · {p.market}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-default items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                          <span
                            aria-label={`${EVIDENCE_LIGHT[p.light].label} evidence`}
                            className={`size-2 shrink-0 rounded-full ${EVIDENCE_LIGHT[p.light].dot}`}
                          />
                          {EVIDENCE_LIGHT[p.light].label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {EVIDENCE_LIGHT[p.light].meaning} ({p.tier}) — {p.tierNote}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-muted-foreground">No verdict yet</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Provenance kind="simulated" /> Verdicts are a model-based interpretation of evidence, not a customer vote.
      </p>
    </>
  )
}
