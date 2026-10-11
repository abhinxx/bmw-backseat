import { ArrowRight } from "lucide-react"

import { Provenance, type ProvenanceKind } from "@/components/provenance"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { FunnelCounts } from "@/lib/requirements/funnel"

const n = (x: number) => x.toLocaleString("en-US")

type Tile = {
  label: string
  value: number | null
  kind?: ProvenanceKind
  note?: string
}

// Outside findings = verified public data + Research Agent findings; null only when neither table answers.
function outsideTotal(c: FunnelCounts): number | null {
  if (c.outside === null && c.research === null) return null
  return (c.outside ?? 0) + (c.research ?? 0)
}

export function FunnelTiles({ counts }: { counts: FunnelCounts }) {
  const tiles: Tile[] = [
    { label: "Customer comments", value: counts.comments, kind: "calculated" },
    { label: "Outside findings", value: outsideTotal(counts), kind: "external" },
    { label: "Features", value: counts.features, note: `BMW taxonomy grouped into ${counts.features} features` },
    { label: "Requirements", value: counts.requirements },
    { label: "Approved by the PM", value: counts.approved },
  ]

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {tiles.map((t, i) => (
        <div key={t.label} className="flex min-w-0 flex-1 basis-40 items-center gap-2">
          <Card size="sm" className="flex-1 gap-2 bg-card/60">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
              {t.kind && <Provenance kind={t.kind} />}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {t.value === null ? "—" : n(t.value)}
              </p>
              {t.value === null ? (
                <p className="text-[11px] text-muted-foreground">not created yet</p>
              ) : (
                t.note && <p className="text-[11px] text-muted-foreground">{t.note}</p>
              )}
            </CardContent>
          </Card>
          {i < tiles.length - 1 && (
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
          )}
        </div>
      ))}
    </div>
  )
}
