import { connection } from "next/server"
import Link from "next/link"
import { History as HistoryIcon } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Card, CardContent } from "@/components/ui/card"
import { recentResearch, recentRuns, tally } from "@/lib/history"
import { MISSIONS, type MissionId } from "@/lib/research"

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })

export default async function History() {
  await connection() // render on every request, never prerendered
  const [runs, research] = await Promise.all([recentRuns(), recentResearch()])

  return (
    <>
      <PageHeader
        title="History"
        description="Every what-if, research run and decision, with the exact evidence, model and time. Reopen anything as it was."
      />
      {runs.length + research.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={HistoryIcon} title="Nothing logged yet" className="py-16">
              This is the audit trail for decision gates. Entries are append-only and never edited.
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="pb-4 text-sm text-muted-foreground">
            {runs.length} what-if runs saved. Each one stores the question, the model, and the exact evidence every
            segment saw.
          </p>
          <Card>
            <CardContent className="divide-y p-0">
              {runs.map((run) => {
                const counts = tally(run.verdicts)
                return (
                  <Link
                    key={run.id}
                    href={`/what-if?v=${run.vehicle}&run=${run.id}`}
                    className="flex items-center justify-between gap-4 rounded-md px-4 py-3 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{run.question}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Europe/Berlin",
                        })}{" "}
                        · {run.vehicle} ·{" "}
                        {run.feature_id ? run.feature_id.replaceAll("_", " ") : "no feature matched"} · {run.model}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
                      <span className="text-observed">{counts.more} more likely</span>
                      <span className="text-muted-foreground">{counts.none} no effect</span>
                      <span className="text-destructive">{counts.less} less likely</span>
                      <span className="text-muted-foreground">{counts.noEvidence} no evidence</span>
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
          <p className="pt-8 pb-4 text-sm text-muted-foreground">
            {research.length} research runs saved. Each one stores every search, every page the model read, every finding with
            its source, and what was dropped.
          </p>
          <Card>
            <CardContent className="divide-y p-0">
              {research.map((r) => (
                <Link
                  key={r.id}
                  href={`/research?v=${r.vehicle}&run=${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-md px-4 py-3 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {when(r.created_at)} · {r.vehicle} · {MISSIONS[r.mission as MissionId]?.label ?? r.mission} · {r.depth} · {r.model}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
                    <span className="text-muted-foreground">{r.linkup_calls} searches</span>
                    <span className="text-chart-1">{r.findings[0]?.count ?? 0} findings</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
