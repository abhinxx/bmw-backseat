import { FlaskConical, Gauge, Globe, History, ListChecks } from "lucide-react"

// Single source for the sidebar, the top bar title and the ⌘K menu.
export const NAV = [
  {
    href: "/",
    title: "Mission Control",
    icon: Gauge,
    purpose: "Understand the market for this car in 30 seconds.",
  },
  {
    href: "/what-if",
    title: "What-If Studio",
    icon: FlaskConical,
    purpose: "Propose a change and see how evidence-backed customer segments react.",
  },
  {
    href: "/requirements",
    title: "Requirements",
    icon: ListChecks,
    purpose: "Review, challenge, edit, approve or reject AI-drafted requirements.",
  },
  {
    href: "/research",
    title: "Research Agent",
    icon: Globe,
    purpose: "Check competitors, reviews and owner forums for what BMW data cannot say.",
  },
  {
    href: "/history",
    title: "History",
    icon: History,
    purpose: "Every simulation, research run and decision, in order. The audit trail.",
  },
] as const

export const navFor = (pathname: string) =>
  NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0]

export const SUGGESTED_WHAT_IFS = [
  "Make rear-seat heating standard",
  "Simplify the iDrive controls",
  "Raise the price by €2,000 for more range",
] as const
