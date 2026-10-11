// "What customers talk about": one stacked bar per top theme (likes / problems / wants),
// bar length comparable across themes (total vs the largest theme).
import type { ThemeRow } from "@/lib/data"

const n = (x: number) => x.toLocaleString("en-US")

const LEGEND = [
  { key: "positive", label: "Likes", dot: "bg-observed" },
  { key: "negative", label: "Problems", dot: "bg-destructive" },
  { key: "want", label: "Wants", dot: "bg-chart-1" },
] as const

export type ThemeBar = { name: string; positive: number; negative: number; want: number; total: number }

export function topThemeBars(rows: ThemeRow[], limit = 8): ThemeBar[] {
  const byName = new Map<string, ThemeBar>()
  for (const r of rows) {
    const b = byName.get(r.level2) ?? { name: r.level2, positive: 0, negative: 0, want: 0, total: 0 }
    b[r.sentiment] += r.comments
    b.total += r.comments
    byName.set(r.level2, b)
  }
  return [...byName.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, limit)
}

export function ThemeChart({ bars }: { bars: ThemeBar[] }) {
  const max = bars[0]?.total ?? 1
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>
      <ul className="space-y-2.5">
        {bars.map((b) => (
          <li key={b.name} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm" title={b.name}>
              {b.name}
            </span>
            <div
              className="flex h-2.5 min-w-0 flex-1 items-stretch"
              title={`${b.name}: ${n(b.positive)} likes · ${n(b.negative)} problems · ${n(b.want)} wants`}
            >
              <div className="flex h-full min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full" style={{ width: `${(b.total / max) * 100}%` }}>
                  {b.positive > 0 && <div className="h-full bg-observed" style={{ width: `${(b.positive / b.total) * 100}%` }} />}
                  {b.negative > 0 && <div className="h-full bg-destructive" style={{ width: `${(b.negative / b.total) * 100}%` }} />}
                  {b.want > 0 && <div className="h-full bg-chart-1" style={{ width: `${(b.want / b.total) * 100}%` }} />}
                </div>
              </div>
            </div>
            <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{n(b.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
