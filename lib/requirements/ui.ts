// Shared class names for requirement chips (board and detail page).
import type { Priority, ReqStatus, Requirement } from "@/lib/requirements/types"

export const STATUS_CLS: Record<ReqStatus, string> = {
  proposed: "bg-secondary text-muted-foreground",
  in_review: "bg-calculated/10 text-calculated",
  approved: "bg-observed/10 text-observed",
  rejected: "bg-destructive/10 text-destructive",
  postponed: "bg-inferred/10 text-inferred",
}

export const PRIORITY_CLS: Record<Priority, string> = {
  P1: "bg-foreground text-background",
  P2: "bg-secondary text-foreground",
  P3: "bg-secondary text-muted-foreground",
}

export const openRequirementCount = (rows: Requirement[], market: string) =>
  rows.filter((r) => ["proposed", "in_review"].includes(r.status) && (market === "all" || r.markets.includes(market))).length

export const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso))
