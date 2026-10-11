import { connection } from "next/server"
import Link from "next/link"
import { History as HistoryIcon } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Card, CardContent } from "@/components/ui/card"
import { recentRuns, tally } from "@/lib/history"

export default async function History() {
  await connection() // render on every request, never prerendered
  const runs = await recentRuns()

  return (
    <>
      <PageHeader
        title="History"
        description="Every what-if, research run and decision, with the exact evidence, model and time. Reopen anything as it was."
      />
      {runs.length === 0 ? (
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
        </>
      )}
    </>
  )
}
