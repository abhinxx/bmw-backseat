import { connection } from "next/server"
import Link from "next/link"
import { FlaskConical, Globe, History as HistoryIcon } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Card, CardContent } from "@/components/ui/card"
import { recentResearch, recentRuns, tally } from "@/lib/history"
import { MISSIONS, type MissionId } from "@/lib/research"
import { cn } from "@/lib/utils"

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })

const TYPES = { all: "All", whatif: "What-if", research: "Research" } as const
type TypeId = keyof typeof TYPES

// One timeline: every what-if and every research run, newest first, each tagged with what it was.
export default async function History({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await connection() // render on every request, never prerendered
  const { type } = await searchParams
  const show: TypeId = type === "whatif" || type === "research" ? type : "all"
  const [runs, research] = await Promise.all([recentRuns(), recentResearch()])

  const items = [
    ...runs.map((r) => ({ kind: "whatif" as const, at: r.created_at, r })),
    ...research.map((r) => ({ kind: "research" as const, at: r.created_at, r })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const count: Record<TypeId, number> = { all: items.length, whatif: runs.length, research: research.length }
  const shown = items.filter((it) => show === "all" || it.kind === show)

  return (
    <>
      <PageHeader
        title="History"
        description="Every what-if and research run, newest first, with the exact evidence, model and time. Reopen anything as it was."
      />
      {items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={HistoryIcon} title="Nothing logged yet" className="py-16">
              This is the audit trail for decision gates. Entries are append-only and never edited.
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 pb-4">
            {(Object.keys(TYPES) as TypeId[]).map((t) => (
              <Link
                key={t}
                href={t === "all" ? "/history" : `/history?type=${t}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  show === t ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {TYPES[t]} <span className="tabular-nums opacity-60">{count[t]}</span>
              </Link>
            ))}
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {shown.map((it) => {
                if (it.kind === "research")
                  return (
                    <Row
                      key={it.r.id}
                      href={`/research?v=${it.r.vehicle}&run=${it.r.id}`}
                      kind="research"
                      title={it.r.question}
                      meta={`${when(it.r.created_at)} · ${it.r.vehicle} · ${MISSIONS[it.r.mission as MissionId]?.label ?? it.r.mission} · ${it.r.depth} · ${it.r.model}`}
                    >
                      <span className="text-muted-foreground">{it.r.linkup_calls} searches</span>
                      <span className="text-chart-1">{it.r.findings[0]?.count ?? 0} findings</span>
                    </Row>
                  )
                const c = tally(it.r.verdicts)
                return (
                  <Row
                    key={it.r.id}
                    href={`/what-if?v=${it.r.vehicle}&run=${it.r.id}`}
                    kind="whatif"
                    title={it.r.question}
                    meta={`${when(it.r.created_at)} · ${it.r.vehicle} · ${it.r.feature_id ? it.r.feature_id.replaceAll("_", " ") : "no feature matched"} · ${it.r.model}`}
                  >
                    <span className="text-observed">{c.more} more likely</span>
                    <span className="text-muted-foreground">{c.none} no effect</span>
                    <span className="text-destructive">{c.less} less likely</span>
                    <span className="text-muted-foreground">{c.noEvidence} no evidence</span>
                  </Row>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

function Row({ href, kind, title, meta, children }: { href: string; kind: "whatif" | "research"; title: string; meta: string; children: React.ReactNode }) {
  const Icon = kind === "whatif" ? FlaskConical : Globe
  return (
    <Link href={href} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex w-[5.75rem] shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
            kind === "whatif" ? "bg-simulated/10 text-simulated" : "bg-chart-1/10 text-chart-1"
          )}
        >
          <Icon className="size-3.5" /> {kind === "whatif" ? "What-if" : "Research"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-4 text-xs tabular-nums sm:flex">{children}</div>
    </Link>
  )
}
