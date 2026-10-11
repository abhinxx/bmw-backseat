import { Bot, Calculator, UserCheck, type LucideIcon } from "lucide-react"

const COLUMNS: { icon: LucideIcon; title: string; items: string[] }[] = [
  {
    icon: Bot,
    title: "AI does on its own",
    items: [
      "Reads and summarises the evidence it is given",
      "Drafts requirement text, measurable target, rationale, assumptions and uncertainties",
      "Looks for counter-evidence when the PM clicks Challenge",
      "Plans web searches in the Research Agent",
    ],
  },
  {
    icon: Calculator,
    title: "Code computes",
    items: [
      "Groups comments into features and counts each comment once",
      "Every number, factor and score",
      "Evidence level A–D",
      "Drops any citation the AI was not given and logs it",
      "Flags conflicting signals",
    ],
  },
  {
    icon: UserCheck,
    title: "Only the PM decides",
    items: [
      "Approve, reject or postpone, with a reason",
      "Edit the text or target",
      "Override the priority, with a reason",
      "What leaves the tool (export)",
    ],
  },
]

export function Boundaries() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {COLUMNS.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.title} className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              {c.title}
            </p>
            <ul className="mt-3 space-y-2 border-l pl-4 text-sm text-muted-foreground">
              {c.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
