import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { DEFAULT_WEIGHTS, EVIDENCE_LEVELS, FACTORS, PRIORITY_RULE } from "@/lib/requirements/config"

export function ScoreMethod() {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Factor</th>
              <th className="py-2 pr-4 font-medium">What it measures</th>
              <th className="py-2 pr-4 text-right font-medium">Default weight</th>
              <th className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(FACTORS).map(([id, f]) => (
              <tr key={id} className="border-b border-border/60 align-top last:border-0">
                <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{f.label}</td>
                <td className="max-w-xl py-2.5 pr-4 text-muted-foreground">{f.definition}</td>
                <td className="py-2.5 pr-4 text-right font-medium tabular-nums">{DEFAULT_WEIGHTS[id as keyof typeof DEFAULT_WEIGHTS]}</td>
                <td className="py-2.5 font-mono text-xs text-muted-foreground">{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRIORITY_RULE.map((p) => (
          <Badge key={p.priority} variant="outline" className="gap-1.5 px-2.5">
            <span className="font-semibold">{p.priority}</span>
            <span className="text-muted-foreground">≥ {p.min}</span>
            <span className="hidden text-muted-foreground sm:inline">· {p.label}</span>
          </Badge>
        ))}
      </div>

      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {Object.entries(EVIDENCE_LEVELS).map(([level, text]) => (
          <li key={level} className="flex gap-2.5 text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
              {level}
            </span>
            {text}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        The AI never produces a number. Weights are visible in{" "}
        <Link href="/settings#method" className="font-medium text-foreground underline-offset-4 hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
