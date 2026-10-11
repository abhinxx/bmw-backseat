import { SOURCE_HIERARCHY } from "@/lib/requirements/config"

export function SourceHierarchy() {
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {SOURCE_HIERARCHY.map((s) => (
          <li key={s.tier} className="flex gap-3.5">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
              {s.tier}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.detail}</p>
              <p className="font-mono text-[11px] text-muted-foreground/70">{s.tables}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        When sources disagree, the higher tier wins and the conflict is shown on the requirement, never hidden.
      </p>
    </div>
  )
}
