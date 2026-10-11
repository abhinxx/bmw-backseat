// Mission Control "What changed": the latest research findings that matched a feature, and the latest what-ifs.
// Findings that matched no feature stay in History only (ARCHITECTURE.md §7).
import { Activity, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { featureOf } from "@/lib/features"
import { featureFindings, recentRuns } from "@/lib/history"

const RELATION: Record<string, string> = {
  agrees: "agrees with BMW data",
  contradicts: "contradicts BMW data",
  new_signal: "new signal",
  context: "context",
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })

export async function WhatChanged({ vehicle, scope }: { vehicle: string; scope: string }) {
  const [findings, runs] = await Promise.all([featureFindings(vehicle, 6), recentRuns(10)])
  const items = [
    ...findings.map((f) => ({ kind: "finding" as const, at: f.created_at, f })),
    ...runs.filter((r) => r.vehicle === vehicle).slice(0, 4).map((r) => ({ kind: "run" as const, at: r.created_at, r })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)

  if (items.length === 0)
    return (
      <EmptyState icon={Activity} title="Nothing yet">
        Every what-if and research run will show up here.
      </EmptyState>
    )

  return (
    <ul className="divide-y text-sm">
      {items.map((it) =>
        it.kind === "finding" ? (
          <li key={it.f.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0 space-y-0.5">
              <p className="leading-snug">{it.f.claim}</p>
              <p className="text-xs text-muted-foreground">
                {featureOf(it.f.feature_id)?.name ?? it.f.feature_id}
                {it.f.relation ? ` · ${RELATION[it.f.relation] ?? it.f.relation}` : ""} · {when(it.f.created_at)} ·{" "}
                <Link href={`/research?${scope}&run=${it.f.run_id}`} className="hover:underline">
                  research run
                </Link>{" "}
                ·{" "}
                <a href={it.f.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                  {it.f.source_name ?? "source"} <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
            <Provenance kind="external" />
          </li>
        ) : (
          <li key={it.r.id}>
            <Link href={`/what-if?${scope}&run=${it.r.id}`} className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate leading-snug">What-if: {it.r.question}</p>
                <p className="text-xs text-muted-foreground">
                  {it.r.verdicts.length} segments reacted · {when(it.r.created_at)}
                </p>
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        )
      )}
    </ul>
  )
}
