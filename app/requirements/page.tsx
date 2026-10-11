import Link from "next/link"
import { AlertTriangle, ListChecks } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { CreateRequirements } from "@/components/requirements/create-dialog"
import { ExportMenu } from "@/components/requirements/export-menu"
import { Card, CardContent } from "@/components/ui/card"
import { EVIDENCE_LEVELS, KIND_LABEL, STATUS_LABEL } from "@/lib/requirements/config"
import { listRequirements, recentRuns, usShare } from "@/lib/requirements/data"
import { REQ_STATUSES, type ReqRun, type ReqStatus, type Requirement } from "@/lib/requirements/types"
import { PRIORITY_CLS, STATUS_CLS, when } from "@/lib/requirements/ui"
import { marketOf, vehicleOf } from "@/lib/scope"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function Requirements({ searchParams }: { searchParams: Promise<{ v?: string; m?: string; status?: string }> }) {
  const { v, m, status } = await searchParams
  const vehicle = vehicleOf(v)
  const show = REQ_STATUSES.includes(status as ReqStatus) ? (status as ReqStatus) : "all"
  const market = marketOf(m)
  const [allReqs, runs, us] = await Promise.all([listRequirements(vehicle.id), recentRuns(vehicle.id, 3), usShare(vehicle.id)])
  const reqs = market.id === "all" ? allReqs : allReqs.filter((r) => r.markets.includes(market.id))
  const count = Object.fromEntries(REQ_STATUSES.map((s) => [s, reqs.filter((r) => r.status === s).length])) as Record<ReqStatus, number>
  const shown = show === "all" ? reqs : reqs.filter((r) => r.status === show)
  const lastDone = runs.find((r) => r.status === "done") ?? null
  const scope = (extra: Record<string, string> = {}) => `?${new URLSearchParams({ v: vehicle.id, ...(m ? { m } : {}), ...extra }).toString()}`

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name} · ${vehicle.horizon}`}
        title="Requirements"
        description="Code finds the candidates and computes every score. The AI drafts the text from cited evidence. Only you approve, edit, reject or postpone, and every change is logged."
        action={
          <div className="flex items-center gap-2">
            <ExportMenu requirements={reqs} vehicle={vehicle.id} />
            <CreateRequirements vehicle={vehicle.id} vehicleName={vehicle.name} hasRequirements={allReqs.length > 0} />
          </div>
        }
      />

      <p className="mb-4 text-xs text-muted-foreground">Scores use all available markets for this car line. The market picker filters requirements by where a signal exists; it does not recompute scores.</p>
      {reqs.length > 0 && (
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <RunStrip run={lastDone} />
          {us !== null && us >= 0.7 && (
            <div className="flex items-start gap-2 rounded-xl border border-inferred/25 bg-inferred/5 px-4 py-3 text-sm lg:max-w-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-inferred" />
              <p>
                <span className="font-medium">{Math.round(us * 100)}% of this car&apos;s feedback is from the US.</span>{" "}
                <span className="text-muted-foreground">Customer voice reflects US owners most; market reach and the study add Europe and China.</span>
              </p>
            </div>
          )}
        </div>
      )}

      {reqs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={ListChecks} title={`No requirements for the ${vehicle.name} yet`} className="py-16">
              {allReqs.length ? `No requirements have a signal in ${market.name}. Select All markets to review the full list.` : "Create requirements runs the pipeline on BMW data for this car line. You can add public data, research findings, What-If results and your own CSV."}
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 pb-4">
            {(["all", ...REQ_STATUSES] as const).map((s) => (
              <Link
                key={s}
                href={`/requirements${scope(s === "all" ? {} : { status: s })}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  show === s ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]} <span className="tabular-nums opacity-60">{s === "all" ? reqs.length : count[s]}</span>
              </Link>
            ))}
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Ranked by score ·{" "}
              <Link href={`/workflow${scope()}`} className="underline-offset-2 hover:underline">
                how it works
              </Link>
            </span>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {shown.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
              {shown.map((r) => (
                <Row key={r.id} r={r} href={`/requirements/${r.code}${scope()}`} />
              ))}
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Evidence level {Object.entries(EVIDENCE_LEVELS).map(([k, t]) => `${k} ${t.split(":")[0].toLowerCase()}`).join(" · ")}. Priority comes from the score unless the PM overrides it (marked ✎).
          </p>
        </>
      )}
    </>
  )
}

function Row({ r, href }: { r: Requirement; href: string }) {
  const p = r.priority_override ?? r.priority
  return (
    <Link href={href} className="group grid grid-cols-[2rem_1fr] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[2rem_1fr_auto]">
      <span className="text-sm font-medium tabular-nums text-muted-foreground">{r.rank}</span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium" title={KIND_LABEL[r.kind].hint}>
            {KIND_LABEL[r.kind].label}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLS[r.status])}>{STATUS_LABEL[r.status]}</span>
          {r.conflicts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-inferred">
              <AlertTriangle className="size-3" />
              {r.conflicts.length} conflict{r.conflicts.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="truncate text-[15px] font-medium group-hover:underline group-hover:underline-offset-2">{r.title}</p>
        <p className="line-clamp-1 text-sm text-muted-foreground">{r.description}</p>
      </div>
      <div className="col-start-2 flex items-center gap-4 md:col-start-auto">
        <span className="text-xs text-muted-foreground">{r.markets.join(" · ")}</span>
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-secondary text-xs font-semibold" title={EVIDENCE_LEVELS[r.evidence_level]}>
          {r.evidence_level}
        </span>
        <div className="flex w-24 items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${r.score}%` }} />
          </div>
          <span className="w-6 text-right text-sm tabular-nums">{r.score}</span>
        </div>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", PRIORITY_CLS[p])}>
          {p}
          {r.priority_override && " ✎"}
        </span>
      </div>
    </Link>
  )
}

function RunStrip({ run }: { run: ReqRun | null }) {
  if (!run) return <div />
  const on = (b: boolean) => (b ? "text-foreground" : "text-muted-foreground line-through")
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 text-xs">
      <span className="font-medium">Built from</span>
      <span className="text-foreground">BMW internal data</span>
      <span className={on(run.options.public)}>Public data</span>
      <span className={on(run.options.research)}>Research findings</span>
      <span className={on(run.options.whatif)}>What-If</span>
      {run.csv_name && (
        <span>
          CSV {run.csv_name} · {run.csv_count} rows (unverified)
        </span>
      )}
      <span className="text-muted-foreground">
        · {when(run.created_at)} · {run.actor ?? "unknown"} · {run.model} · {run.prompt_version} · {run.score_version}
        {run.duration_ms ? ` · ${Math.round(run.duration_ms / 1000)}s` : ""}
      </span>
      <Provenance kind="calculated" className="ml-auto" />
    </div>
  )
}
