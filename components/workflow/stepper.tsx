import { Bot, Calculator, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { WORKFLOW } from "@/lib/requirements/config"
import { cn } from "@/lib/utils"

const ROLES: Record<string, { icon: LucideIcon; label: string; hint: string; cls: string }> = {
  ai: { icon: Bot, label: "AI", hint: "Language model, under citation checks", cls: "text-inferred bg-inferred/10" },
  code: {
    icon: Calculator,
    label: "Code",
    hint: "Deterministic, same input same output",
    cls: "text-calculated bg-calculated/10",
  },
  pm: {
    icon: UserCheck,
    label: "Product manager",
    hint: "Human decision, mandatory",
    cls: "text-primary bg-primary/10",
  },
}

export function WorkflowStepper() {
  return (
    <ol className="space-y-0">
      {WORKFLOW.map((w, i) => {
        const role = ROLES[w.who]
        const Icon = role.icon
        const last = i === WORKFLOW.length - 1
        return (
          <li key={w.step} className="relative flex gap-4 pb-6 last:pb-0">
            {/* rail */}
            {!last && <span className="absolute top-9 left-[17px] bottom-0 w-px bg-border" aria-hidden />}
            <div
              className={cn(
                "z-0 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                w.who === "pm" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <div className="min-w-0 space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{w.step}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex h-5 cursor-default items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
                        role.cls
                      )}
                    >
                      <Icon className="size-3" />
                      {role.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{role.hint}</TooltipContent>
                </Tooltip>
                {w.who === "pm" && (
                  <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-2 text-[11px] font-medium text-primary">
                    <ShieldCheck className="size-3" />
                    Gate · human review mandatory
                  </span>
                )}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">{w.does}</p>
              {w.who === "pm" && (
                <p className="text-xs text-muted-foreground">
                  Nothing is exported to Codebeamer until a requirement is approved.
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
