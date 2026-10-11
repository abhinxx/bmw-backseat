import { Flag } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CoverageWarning, Provenance } from "@/components/provenance"
import { cn } from "@/lib/utils"
import { AXIS_START, fmtMonth, monthOf, pctOf, timelineStatus, type PhaseStatus } from "@/lib/product-timeline"

const BAR: Record<PhaseStatus, string> = {
  done: "bg-chart-2",
  current: "bg-chart-1",
  upcoming: "bg-muted-foreground/25",
}

function Stat({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", accent && "text-chart-1")}>{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

/** 13-stage stage-gate timeline for the vehicle's successor programme. */
export function ProductDevelopmentTimeline({
  vehicleName,
  vehicleId,
  className,
}: {
  vehicleName: string
  vehicleId: string
  className?: string
}) {
  const now = new Date()
  const t = timelineStatus(now)
  const todayPct = pctOf(t.today)
  const years = [2026, 2027, 2028, 2029, 2030]
  const started = fmtMonth(AXIS_START)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Development timeline · {vehicleName} ({vehicleId}) successor</CardTitle>
          <CardDescription>
            The 13-stage product-development process, placed on the programme calendar. The programme started{" "}
            {started}, {vehicleName} launches at SOP in {fmtMonth(t.launch.date)}.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Provenance kind="inferred" />
          <CoverageWarning>No real programme dates in the data</CoverageWarning>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Overview strip */}
        <div className="grid gap-4 rounded-lg border bg-card/50 p-4 sm:grid-cols-4">
          <Stat label="Programme started" value={fmtMonth(t.start.date)} note={`Gate ${t.start.gate}`} />
          <Stat
            label="Current phase"
            value={`${t.current.n} · ${t.current.short}`}
            note={`${Math.round(t.current.progress * 100)}% elapsed · since ${fmtMonth(t.current.start)}`}
            accent
          />
          <Stat
            label="Next step due"
            value={fmtMonth(t.nextDeadline.date)}
            note={`${t.nextDeadline.monthsLeft} months · ${t.nextDeadline.gate}`}
          />
          <Stat label="Planned launch (SOP)" value={fmtMonth(t.launch.date)} note={`Market launch with ${t.phases[9].short.toLowerCase()} by ${fmtMonth(t.phases[10].end)}`} />
        </div>

        {/* Gantt */}
        <div className="grid grid-cols-[minmax(120px,168px)_1fr] items-stretch gap-x-3 text-xs">
          {/* Row labels */}
          <div className="space-y-1.5">
            {t.phases.map((p) => (
              <div key={p.n} className="flex h-[18px] items-center gap-2">
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    p.status === "done" && "bg-chart-2/15 text-chart-2",
                    p.status === "current" && "bg-chart-1 text-primary-foreground",
                    p.status === "upcoming" && "bg-muted text-muted-foreground"
                  )}
                >
                  {p.n}
                </span>
                <span className={cn("truncate", p.status === "current" ? "font-semibold" : "text-muted-foreground")}>
                  {p.short}
                </span>
              </div>
            ))}
          </div>

          {/* Bars + gridlines */}
          <div className="relative">
            {/* year gridlines + labels */}
            {years.map((y) => (
              <span
                key={y}
                className="absolute bottom-[-18px] top-0 border-l border-border/60"
                style={{ left: `${pctOf(monthOf(new Date(y, 0, 1)))}%` }}
              />
            ))}

            <div className="space-y-1.5">
              {t.phases.map((p) => {
                const left = pctOf(p.start)
                const width = pctOf(p.end) - left
                const wide = width > 13
                return (
                  <div key={p.n} className="relative h-[18px]">
                    <span
                      title={`${p.name} · ${fmtMonth(p.start)} → ${p.ongoing ? "ongoing" : fmtMonth(p.end)} · closes ${p.gate}`}
                      className={cn(
                        "absolute top-[3px] flex h-3 items-center overflow-hidden rounded-full",
                        BAR[p.status],
                        p.status === "current" && "shadow-sm ring-2 ring-chart-1/30",
                        p.status === "upcoming" && !p.ongoing && "bg-muted/70"
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {p.status === "current" && (
                        <span className="block h-full rounded-full bg-chart-3" style={{ width: `${p.progress * 100}%` }} />
                      )}
                      {wide && p.status !== "current" && (
                        <span className="px-1.5 text-[9px] leading-none text-foreground/70">
                          {p.status === "done" ? "done" : p.ongoing ? "ongoing" : "planned"}
                        </span>
                      )}
                    </span>
                    {/* gate diamond at phase end */}
                    {!p.ongoing && (
                      <span
                        title={`Gate ${p.gate} · ${fmtMonth(p.end)}`}
                        className={cn(
                          "absolute top-[5px] size-2.5 rotate-45 border",
                          p.status === "done" ? "border-chart-2 bg-chart-2" : "border-muted-foreground/50 bg-background"
                        )}
                        style={{ left: `calc(${pctOf(p.end)}% - 5px)` }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* today line */}
            <span className="pointer-events-none absolute bottom-[-18px] top-0 z-10 w-px bg-destructive" style={{ left: `${todayPct}%` }}>
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-destructive px-1 text-[9px] font-semibold text-white whitespace-nowrap">
                today
              </span>
            </span>
            {/* SOP / launch line */}
            <span className="pointer-events-none absolute bottom-[-18px] top-0 w-px border-l-2 border-dashed border-chart-1/70" style={{ left: `${pctOf(t.launch.date)}%` }} />
          </div>

          {/* month axis */}
          <div />
          <div className="relative h-[18px] text-[10px] text-muted-foreground">
            {years.map((y) => (
              <span key={y} className="absolute top-0.5 -translate-x-1/2 tabular-nums" style={{ left: `${pctOf(monthOf(new Date(y, 0, 1)))}%` }}>
                {y}
              </span>
            ))}
          </div>
        </div>

        {/* Group bands */}
        <div className="grid grid-cols-[minmax(120px,168px)_1fr] items-center gap-x-3">
          <p className="text-[11px] text-muted-foreground">Phase groups</p>
          <div className="relative h-5">
            {t.groups.map((g) => (
              <span
                key={g.name}
                title={`${g.name} · phases ${g.phases} · ${fmtMonth(g.start)} → ${fmtMonth(g.end)}`}
                className="absolute top-0 flex h-5 items-center overflow-hidden rounded-md bg-muted px-1.5 text-[9px] text-muted-foreground"
                style={{ left: `${pctOf(g.start)}%`, width: `${pctOf(g.end) - pctOf(g.start)}%` }}
              >
                <span className="truncate">{g.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-2" /> Done</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-1" /> In progress (inner fill = elapsed)</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted ring-1 ring-border" /> Planned</span>
          <span className="flex items-center gap-1.5"><Flag className="size-3" /><span className="inline-block size-2 rotate-45 border border-muted-foreground/50 bg-background" /> Phase gate</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-destructive" /> Today</span>
          <span className="flex items-center gap-1.5"><span className="h-3 border-l-2 border-dashed border-chart-1/70" /> SOP / launch</span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Assumption:</span> BMW&apos;s dataset carries no project dates — the
          calendar is illustrative planning data for the {vehicleName} successor (&quot;{vehicleId}&quot;, 2030 horizon), built
          by anchoring programme start to {started}, launch to the 2030 sales forecast, and ordering/durations to
          the standard 13-stage stage-gate process (gates G0–G12). Phase {t.current.n} (&quot;{t.current.name}&quot;) must
          close by <span className="font-medium text-foreground">{fmtMonth(t.nextDeadline.date)}</span> at gate{" "}
          {t.nextDeadline.gate} to hold the {fmtMonth(t.launch.date)} SOP. Swap in real milestone data from the programme
          office to make this observed.
        </p>
      </CardContent>
    </Card>
  )
}
