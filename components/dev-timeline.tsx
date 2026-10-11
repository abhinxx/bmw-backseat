// Compact rebuild of partner PR #10's Mission Control timeline: one Card, one
// horizontal stage-gate bar (13 phases) instead of their 268-line SVG Gantt.
import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtMonth, pctOf, timelineStatus } from "@/lib/product-timeline"
import { cn } from "@/lib/utils"

// Seven phase groups folded onto the five chart colours.
const GROUP_COLOR: Record<string, string> = {
  "Discovery & Planning": "bg-chart-1",
  "Design & Engineering": "bg-chart-2",
  "Prototype & Validation": "bg-chart-3",
  Homologation: "bg-chart-4",
  Industrialization: "bg-chart-4",
  Production: "bg-chart-5",
  "Post Launch": "bg-chart-5",
}

export function DevTimeline({ vehicleName }: { vehicleName: string }) {
  const s = timelineStatus(new Date())
  const todayPct = Math.min(100, Math.max(0, pctOf(s.today)))
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Development timeline</CardTitle>
          <CardDescription>{vehicleName} successor, stage-gate plan</CardDescription>
        </div>
        <Provenance kind="inferred" />
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* today marker */}
          <div className="absolute -top-1 bottom-4 z-10 w-px bg-foreground" style={{ left: `${todayPct}%` }}>
            <span className="absolute -top-0.5 left-1 text-[10px] font-medium text-foreground">Today</span>
          </div>
          {/* one bar, 13 phases, width ∝ duration */}
          <div className="flex h-4 overflow-hidden rounded-full">
            {s.phases.map((p) => (
              <div
                key={p.n}
                title={`${p.name} · ${fmtMonth(p.start)} – ${fmtMonth(p.end)} · closes ${p.gate}`}
                className={cn(
                  GROUP_COLOR[p.group] ?? "bg-muted-foreground",
                  p.status === "upcoming" && "opacity-30",
                  p.status === "current" && "opacity-90 ring-2 ring-inset ring-foreground/70"
                )}
                style={{ width: `${pctOf(p.end) - pctOf(p.start)}%` }}
              />
            ))}
          </div>
          {/* gate tick marks at each phase close */}
          <div className="relative mt-0.5 h-5">
            {s.phases.map((p) => (
              <div
                key={p.gate + p.n}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${pctOf(p.end)}%` }}
                title={`${p.gate} · ${fmtMonth(p.end)}`}
              >
                <span className="h-1.5 w-px bg-muted-foreground/70" />
                <span className="text-[9px] leading-none text-muted-foreground">{p.gate.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm">
          <span className="font-medium">{s.current.short}</span> now · next gate {s.nextDeadline.gate},{" "}
          {fmtMonth(s.nextDeadline.date)} · planned SOP {fmtMonth(s.launch.date)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Illustrative plan: BMW&apos;s data has no programme dates. Replace with the programme office&apos;s milestones.
        </p>
      </CardContent>
    </Card>
  )
}
