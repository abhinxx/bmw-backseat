import { AlertTriangle } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Honesty as a visual language (PLAN §2): every number, claim and verdict carries one of these.
const KINDS = {
  observed: {
    label: "Observed",
    hint: "Straight from BMW data or a cited source.",
    cls: "text-observed bg-observed/10",
  },
  calculated: {
    label: "Calculated",
    hint: "A count or average computed by the database. Never written by AI.",
    cls: "text-calculated bg-calculated/10",
  },
  inferred: {
    label: "Inferred",
    hint: "A pattern derived from the data, such as segments or themes.",
    cls: "text-inferred bg-inferred/10",
  },
  simulated: {
    label: "Simulated",
    hint: "A model-based interpretation of evidence, not a customer vote.",
    cls: "text-simulated bg-simulated/10",
  },
} as const

export type ProvenanceKind = keyof typeof KINDS

export function Provenance({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const k = KINDS[kind]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 cursor-default items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
            k.cls,
            className
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {k.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{k.hint}</TooltipContent>
    </Tooltip>
  )
}

const LEVELS = { strong: 3, moderate: 2, thin: 1, none: 0 } as const
export type EvidenceLevel = keyof typeof LEVELS

export function EvidenceStrength({ level }: { level: EvidenceLevel }) {
  const n = LEVELS[level]
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-sm", i <= n ? "bg-foreground/70" : "bg-foreground/15")}
            style={{ height: 4 + i * 3 }}
          />
        ))}
      </span>
      Evidence: {level}
    </span>
  )
}

export function CoverageWarning({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-inferred/10 px-2 py-0.5 text-[11px] font-medium text-inferred">
      <AlertTriangle className="size-3" />
      {children}
    </span>
  )
}
