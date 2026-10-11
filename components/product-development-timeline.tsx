import { Flag } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CoverageWarning, Provenance } from "@/components/provenance"
import { cn } from "@/lib/utils"
import { AXIS_START, fmtMonth, timelineStatus, type PhaseStatus } from "@/lib/product-timeline"

const W = 1000
const H = 320
const PAD_L = 46
const PAD_R = 90
const PAD_T = 46
const PAD_B = 42
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

/** Months axis for the climb: programme start -> end of 2030 (post-SOP tail). */
const X0 = AXIS_START
const X1 = (2030 - 2026) * 12 + 12
const xOf = (m: number) => PAD_L + ((m - X0) / (X1 - X0)) * PLOT_W

/** Phases up to this number are part of the climb; its close (SOP) is the summit. */
const CLIMB_END_N = 10

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="size-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" strokeWidth="13" className="stroke-muted" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          strokeWidth="13"
          strokeLinecap="round"
          className="stroke-chart-1"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold tabular-nums leading-none">{Math.round(pct * 100)}%</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

/** 13-stage stage-gate programme view: phase-elapsed ring + "climb to SOP" chart. */
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
  const started = fmtMonth(AXIS_START)

  // ---- climb model: cumulative completion 0 -> 100% from programme start to SOP
  const climb = t.phases.slice(0, CLIMB_END_N)
  const yOf = (frac: number) => PAD_T + (1 - frac) * PLOT_H
  const pts = [
    { x: xOf(climb[0].start), y: yOf(0), m: climb[0].start },
    ...climb.map((p, i) => ({ x: xOf(p.end), y: yOf((i + 1) / CLIMB_END_N), m: p.end })),
  ]
  const top = pts[pts.length - 1]

  // today's position on the climb
  const tm = Math.min(t.today, top.m)
  const ciRaw = climb.findIndex((p) => tm < p.end)
  const ci = ciRaw === -1 ? climb.length - 1 : ciRaw
  const cp = climb[ci]
  const frac =
    cp.end > cp.start ? (ci + (tm - cp.start) / (cp.end - cp.start)) / CLIMB_END_N : ci / CLIMB_END_N
  const todayPt = { x: xOf(tm), y: yOf(Math.min(frac, 1)) }

  const path = (list: { x: number; y: number }[]) =>
    list.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const pastPath = [...pts.filter((p) => p.m <= tm), todayPt]
  const futurePath = [todayPt, ...pts.filter((p) => p.m > tm)]

  const years = [2026, 2027, 2028, 2029, 2030]
  const pillStatus: Record<PhaseStatus, string> = {
    done: "bg-chart-1",
    current: "bg-chart-1/40",
    upcoming: "bg-muted",
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Development timeline · {vehicleName} ({vehicleId}) successor</CardTitle>
          <CardDescription>
            The 13-stage product-development process on the programme calendar. The programme started {started}; the climb
            ends at SOP in {fmtMonth(t.launch.date)}.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Provenance kind="inferred" />
          <CoverageWarning>No real programme dates in the data</CoverageWarning>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Row 1 — current-phase ring (donut-gauge reference design): fills as the deadline nears */}
        <div className="flex flex-col items-center gap-6 rounded-xl border bg-card/50 p-5 sm:flex-row">
          <Ring pct={t.current.progress} label="phase elapsed" sub={`phase ${cp.n} of 13`} />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="text-center sm:text-left">
              <p className="text-[13px] text-muted-foreground">Current phase</p>
              <p className="text-lg font-semibold text-chart-1">
                {t.current.n} · {t.current.name}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The ring fills as the deadline nears —{" "}
                <span className="font-medium text-foreground">{fmtMonth(t.nextDeadline.date)}</span>,{" "}
                {t.nextDeadline.monthsLeft} months left · closes {t.nextDeadline.gate}
              </p>
            </div>
            {/* 13-phase stepper */}
            <div className="flex items-end gap-1">
              {t.phases.map((p) => (
                <div key={p.n} className="min-w-0 flex-1" title={`${p.n} · ${p.name}`}>
                  <p
                    className={cn(
                      "mb-1 hidden truncate text-center text-[9px] tabular-nums sm:block",
                      p.status === "current" ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {p.n}
                  </p>
                  <span
                    className={cn("block h-1.5 rounded-full", pillStatus[p.status])}
                    style={
                      p.status === "current"
                        ? { backgroundImage: `linear-gradient(90deg, var(--chart-1) ${Math.round(p.progress * 100)}%, var(--muted) ${Math.round(p.progress * 100)}%)` }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Started</p>
                <p className="text-sm font-semibold tabular-nums">{fmtMonth(t.start.date)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Next step due</p>
                <p className="text-sm font-semibold tabular-nums text-chart-1">{fmtMonth(t.nextDeadline.date)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">SOP / launch</p>
                <p className="text-sm font-semibold tabular-nums">{fmtMonth(t.launch.date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 — the climb: the schedule as an ascent, one step up per gate, to the SOP summit */}
        <div>
          <p className="mb-1 text-sm font-medium">The climb to SOP</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Every gate cleared is a step up: 0 % at project approval, 100 % when the {vehicleName} goes into production. The
            marker is where the programme stands — and how far it still has to climb.
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Programme climb to SOP chart">
            <defs>
              <linearGradient id="climbFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* gridlines */}
            {[0.5].map((f) => (
              <line key={f} x1={PAD_L} x2={W - PAD_R} y1={yOf(f)} y2={yOf(f)} stroke="var(--border)" strokeDasharray="4 5" />
            ))}
            <text x={PAD_L - 8} y={yOf(0.5) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">½</text>
            <text x={PAD_L - 8} y={yOf(0) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">0</text>
            <text x={PAD_L - 8} y={yOf(1) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">✓</text>
            {years.map((y) => (
              <g key={y}>
                <line x1={xOf((y - 2026) * 12)} x2={xOf((y - 2026) * 12)} y1={PAD_T} y2={H - PAD_B} stroke="var(--border)" opacity="0.5" />
                <text x={xOf((y - 2026) * 12)} y={H - PAD_B + 16} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                  {y}
                </text>
              </g>
            ))}

            {/* finished area + solid climb */}
            <path d={`${path(pastPath)} L${todayPt.x.toFixed(1)},${yOf(0)} L${pts[0].x.toFixed(1)},${yOf(0)} Z`} fill="url(#climbFill)" />
            <path d={path(pastPath)} fill="none" stroke="var(--chart-1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* remaining climb, dashed */}
            <path d={path(futurePath)} fill="none" stroke="var(--chart-1)" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" strokeLinejoin="round" />

            {/* post-SOP plateau */}
            <path d={`M${top.x},${top.y} L${xOf(X1)},${top.y}`} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="6 5" />
            <text x={xOf(X1)} y={top.y + 14} textAnchor="end" fontSize="9.5" fill="var(--muted-foreground)">
              production · field feedback
            </text>

            {/* gate step dots (hover = phase + gate) */}
            {pts.slice(1, -1).map((p, i) => {
              const ph = climb[i + 1]
              return (
                <circle
                  key={ph.n}
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill={p.m <= tm ? "var(--chart-1)" : "var(--background)"}
                  stroke="var(--chart-1)"
                  strokeWidth="2"
                >
                  <title>{`${ph.n} · ${ph.name} — closes ${ph.gate}, ${fmtMonth(ph.end)}`}</title>
                </circle>
              )
            })}

            {/* summit flag: SOP */}
            <line x1={top.x} x2={top.x} y1={top.y} y2={top.y - 20} stroke="var(--chart-1)" strokeWidth="2" />
            <path d={`M${top.x},${top.y - 20} l17,5 -17,5 Z`} fill="var(--chart-1)" />
            <text x={top.x} y={top.y - 26} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--chart-1)">
              SOP {fmtMonth(t.launch.date)}
            </text>

            {/* today marker on the climb */}
            <line x1={todayPt.x} x2={todayPt.x} y1={PAD_T} y2={H - PAD_B} stroke="var(--muted-foreground)" opacity="0.35" />
            <circle cx={todayPt.x} cy={todayPt.y} r="5.5" fill="var(--background)" stroke="var(--chart-1)" strokeWidth="2.5" />
            <g transform={`translate(${Math.min(Math.max(todayPt.x, 60), W - PAD_R - 60)},${PAD_T - 14})`}>
              <rect x="-52" y="-10" width="104" height="18" rx="6" fill="var(--background)" stroke="var(--border)" />
              <text textAnchor="middle" y="3" fontSize="10" fontWeight="600" fill="var(--foreground)">
                {fmtMonth(Math.floor(t.today))} · {Math.round(frac * 100)} % done
              </text>
            </g>
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-chart-1" /> Completed climb</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-chart-1/70" style={{ maskImage: "repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 7px)", WebkitMaskImage: "repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 7px)" }} /> Remaining climb</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-chart-1 bg-background" /> Gate reached / pending (hover)</span>
            <span className="flex items-center gap-1.5"><Flag className="size-3 text-chart-1" /> SOP summit — launch</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-muted-foreground/40" /> Today</span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Assumption:</span> BMW&apos;s dataset carries no project dates — the
          calendar is illustrative planning data for the {vehicleName} successor (&quot;{vehicleId}&quot;, 2030 horizon), built
          by anchoring programme start to {started}, launch to the 2030 sales forecast, and ordering/durations to the standard
          13-stage stage-gate process (gates G0–G12). Phase {t.current.n} (&quot;{t.current.name}&quot;) must close by{" "}
          <span className="font-medium text-foreground">{fmtMonth(t.nextDeadline.date)}</span> at gate {t.nextDeadline.gate} to
          hold the {fmtMonth(t.launch.date)} SOP. Swap in real milestone data from the programme office to make this observed.
        </p>
      </CardContent>
    </Card>
  )
}
