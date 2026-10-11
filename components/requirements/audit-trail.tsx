import { Bot, Calculator, Flag, UserCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ReqEvent } from "@/lib/requirements/types"

const ACTORS = { ai: Bot, code: Calculator, pm: UserCheck, system: Flag } as const

const ACTIONS: Record<string, string> = {
  proposed: "Proposed as a candidate",
  drafted: "Drafted",
  scored: "Scored",
  rescored: "Re-scored",
  evidence: "Evidence changed",
  conflicts: "Conflicts re-checked",
  redrafted: "Redrafted",
  redraft_skipped: "AI redraft not applied",
  edited: "Edited",
  status: "Status changed",
  priority_override: "Priority overridden",
  challenged: "Challenged by the AI",
  flag: "Flag",
  exported: "Exported",
}

const STATUS_WORDS: Record<string, string> = {
  proposed: "Proposed",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  postponed: "Postponed",
}

const VERDICTS: Record<string, { label: string; cls: string }> = {
  holds: { label: "Holds", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  weakened: { label: "Weakened", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  not_supported: { label: "Not supported", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
}

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
})

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const statusWord = (v: string) => STATUS_WORDS[v] ?? v

/** Append-only history of the requirement: who changed what, when and why. Newest first. */
export function AuditTrail({ events }: { events: ReqEvent[] }) {
  if (events.length === 0)
    return <p className="px-1 py-6 text-sm text-muted-foreground">No changes logged yet.</p>

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const Icon = ACTORS[e.actor_type as keyof typeof ACTORS] ?? Flag
        const label =
          e.action === "redrafted" || e.action === "edited"
            ? `${ACTIONS[e.action]} ${e.field ?? ""}`.trim()
            : ACTIONS[e.action] ?? e.action
        return (
          <li
            key={e.id}
            className={cn(
              "relative flex gap-3 pb-4 pl-1",
              i < events.length - 1 && "before:absolute before:top-8 before:bottom-0 before:left-[15px] before:w-px before:bg-border",
              e.actor_type === "pm" && "rounded-lg border-l-2 border-primary bg-primary/5"
            )}
          >
            <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{e.actor}</span>
                <span className="text-xs text-muted-foreground">{timeFmt.format(new Date(e.at))}</span>
              </p>
              <Change event={e} />
              {e.reason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="text-muted-foreground/70">Why: </span>
                  {e.reason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Change({ event }: { event: ReqEvent }) {
  const { action, before, after } = event

  if (action === "challenged" && isObj(after)) {
    const verdict = VERDICTS[String(after.verdict ?? "")]
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {verdict && (
          <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", verdict.cls)}>
            {verdict.label}
          </span>
        )}
        {typeof after.summary === "string" && <span className="text-sm">{after.summary}</span>}
      </div>
    )
  }

  if (action === "evidence" && isObj(after)) {
    const added = Array.isArray(after.added) ? (after.added as unknown[]).map(String) : []
    return (
      <p className="mt-1 text-sm">
        {String(isObj(before) ? before.count : "?")} → {String(after.count)} items
        {added.length > 0 && (
          <span className="text-muted-foreground"> · added: {added.join(", ")}</span>
        )}
      </p>
    )
  }

  if (action === "drafted" && isObj(after) && typeof after.title === "string")
    return <p className="mt-1 text-sm">“{after.title}”</p>

  if (action === "proposed" && isObj(after)) {
    const markets = Array.isArray(after.markets) ? (after.markets as unknown[]).map(String).join(", ") : ""
    return (
      <p className="mt-1 text-sm">
        {String(after.kind ?? "")}
        {markets && <span className="text-muted-foreground"> · {markets}</span>}
      </p>
    )
  }

  const scoreLine = (v: unknown) =>
    isObj(v) && "score" in v
      ? `${String(v.score)} · ${String(v.priority ?? "")} · ${String(v.evidence_level ?? "")}`
      : null

  if (isObj(after) && isObj(before)) {
    const b = scoreLine(before)
    const a = scoreLine(after)
    if (b && a)
      return (
        <p className="mt-1 text-sm tabular-nums">
          <span className="text-muted-foreground line-through">{b}</span>
          <span className="mx-1.5 text-muted-foreground">→</span>
          <span className="font-medium">{a}</span>
        </p>
      )
  }

  if ((typeof before === "string" || before === null) && typeof after === "string")
    return (
      <p className="mt-1 text-sm">
        {before !== null && <span className="text-muted-foreground line-through">{statusWord(before)}</span>}
        {before !== null && <span className="mx-1.5 text-muted-foreground">→</span>}
        <span className="font-medium">{statusWord(after)}</span>
      </p>
    )

  if (isObj(after))
    return (
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Details</summary>
        <pre className="mt-1 overflow-x-auto rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
          {JSON.stringify(after, null, 2)}
        </pre>
      </details>
    )

  return null
}
