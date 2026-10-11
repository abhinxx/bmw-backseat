import Link from "next/link"

import { cn } from "@/lib/utils"
import type { SourceKind, SourceRef } from "@/lib/requirements/types"

// Chip per source kind. Colours match components/provenance.tsx for that provenance kind;
// CSV has no provenance kind of its own — neutral chip, amber dot, labelled unverified.
const KINDS: Record<SourceKind, { label: string; cls: string; dot?: string }> = {
  comment: { label: "BMW feedback", cls: "text-observed bg-observed/10" },
  study: { label: "Customer study", cls: "text-observed bg-observed/10" },
  option: { label: "Price list", cls: "text-observed bg-observed/10" },
  rival: { label: "Rival table", cls: "text-chart-1 bg-chart-1/10" },
  public: { label: "Public source", cls: "text-chart-1 bg-chart-1/10" },
  research: { label: "Research Agent", cls: "text-chart-1 bg-chart-1/10" },
  whatif: { label: "What-If", cls: "text-simulated bg-simulated/10" },
  csv: { label: "Uploaded CSV · unverified", cls: "text-muted-foreground bg-muted", dot: "bg-amber-500" },
}

const GROUPS = [
  { role: "supports", title: "Supports", dot: "bg-emerald-500" },
  { role: "opposes", title: "Argues against", dot: "bg-rose-500" },
  { role: "context", title: "Context the AI was given", dot: "bg-muted-foreground/50" },
] as const

const MAX_SHOWN = 6

/** Every citation the requirement rests on, grouped by what it does to the case. */
export function EvidenceList({ sources }: { sources: SourceRef[] }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const items = sources.filter((s) => s.role === g.role)
        if (items.length === 0) return null
        const shown = items.slice(0, MAX_SHOWN)
        const rest = items.slice(MAX_SHOWN)
        return (
          <div key={g.role}>
            <p className="flex items-center gap-2 px-1 pb-1 text-xs font-medium">
              <span className={cn("size-1.5 rounded-full", g.dot)} />
              {g.title}
              <span className="tabular-nums text-muted-foreground">{items.length}</span>
            </p>
            <ul className="divide-y">
              {shown.map((s) => (
                <Item key={s.id} source={s} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="px-1 pt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Show {rest.length} more
                </summary>
                <ul className="divide-y pt-2">
                  {rest.map((s) => (
                    <Item key={s.id} source={s} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Item({ source }: { source: SourceRef }) {
  const kind = KINDS[source.kind]
  return (
    <li className="flex items-start justify-between gap-3 px-1 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
              kind.cls
            )}
          >
            <span className={cn("size-1.5 rounded-full bg-current", kind.dot)} />
            {kind.label}
          </span>
          <span className="text-xs text-muted-foreground">{source.label}</span>
        </p>
        {source.text && <p className="mt-1 line-clamp-3 text-sm">{source.text}</p>}
        {source.href &&
          (source.href.startsWith("http") ? (
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-primary hover:underline"
            >
              Open source ↗
            </a>
          ) : (
            <Link href={source.href} className="mt-1 inline-block text-xs text-primary hover:underline">
              Open record
            </Link>
          ))}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{source.id}</span>
    </li>
  )
}
