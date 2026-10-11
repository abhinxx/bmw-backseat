import { Provenance } from "@/components/provenance"
import { Card, CardContent } from "@/components/ui/card"
import type { Factor } from "@/lib/requirements/types"

/** The score, shown as its parts: one row per factor, each contribution in points. */
export function FactorTable({ factors, score }: { factors: Factor[]; score: number }) {
  const included = factors.filter((f) => f.included)
  const totalWeight = included.reduce((sum, f) => sum + f.weight, 0)

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {factors.map((f) => {
            const pts =
              f.included && f.value !== null && totalWeight > 0
                ? Math.round((f.value * f.weight) / totalWeight * 100)
                : 0
            return (
              <li key={f.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{f.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">from {f.source}</p>
                </div>
                {f.included && f.value !== null ? (
                  <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(f.value * 100)}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-sm tabular-nums">
                        {Math.round(f.value * 100)}%
                      </span>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      weight {f.weight} · <span className="font-medium text-foreground">+{pts} pts</span>
                    </span>
                  </div>
                ) : (
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">not used</span>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between gap-4 border-t px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="font-medium">Score</span>
            <Provenance kind="calculated" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{score}</p>
            <p className="text-xs text-muted-foreground">
              Weighted average of the factors that apply. The AI never produces a number.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
