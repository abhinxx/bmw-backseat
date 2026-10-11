import { cn } from "@/lib/utils"

// Small neutral chip with a coloured dot: green = connected, grey = not connected.
// Colour only where it carries meaning.
export function StatusChip({ connected, children }: { connected: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-2 text-[11px] font-medium text-secondary-foreground">
      <span className={cn("size-1.5 rounded-full", connected ? "bg-observed" : "bg-muted-foreground/40")} />
      {children}
    </span>
  )
}
