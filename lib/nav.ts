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

// A what-if needs to name a feature and a change; 2-3 word questions find poor evidence.
export const MIN_WORDS = 5
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export const SUGGESTED_WHAT_IFS = [
  "Make adaptive suspension standard on every future 5 Series trim",
  "Simplify the exterior design and remove the illuminated grille",
  "Bring back physical buttons for climate and volume",
  "Make the digital key and wireless CarPlay standard on all trims",
] as const
