// Development-timeline model for Mission Control.
// Maps the 13-stage automotive product-development process (stage-gate, G0-G12)
// onto the selected vehicle's successor programme ("2030 horizon" in lib/scope).
// ASSUMPTION (flagged in the UI): BMW's dataset contains no project dates. The
// dates below are illustrative planning data for the demo programme; the shape
// (phase order, durations, gates) follows the standard stage-gate process.

export type PhaseStatus = "done" | "current" | "upcoming"

export type Phase = {
  n: number
  name: string
  short: string
  group: string
  gate: string // gate that CLOSES this phase
  start: number // months since Jan 2026 (inclusive)
  end: number // months since Jan 2026 (exclusive)
  ongoing?: boolean
}

// month index: y*12 + (m-1) - (2026*12) => months since 2026-01
const M = (y: number, m: number) => (y - 2026) * 12 + (m - 1)

export const PHASES: Phase[] = [
  { n: 1, name: "Market Research & Needs Analysis", short: "Market Research", group: "Discovery & Planning", gate: "G0 · Project Approval", start: M(2026, 1), end: M(2026, 3) },
  { n: 2, name: "Product Planning", short: "Planning", group: "Discovery & Planning", gate: "G1 · Concept Freeze", start: M(2026, 3), end: M(2026, 5) },
  { n: 3, name: "Concept Development", short: "Concept", group: "Discovery & Planning", gate: "G2 · Feasibility Approval", start: M(2026, 5), end: M(2026, 8) },
  { n: 4, name: "Design & Engineering", short: "Design & Eng.", group: "Design & Engineering", gate: "G3 · Design Freeze", start: M(2026, 8), end: M(2027, 6) },
  { n: 5, name: "Prototype Build (Alpha / Beta)", short: "Prototype", group: "Prototype & Validation", gate: "G4 · Prototype Approval", start: M(2027, 6), end: M(2028, 1) },
  { n: 6, name: "Design & Product Validation (DV & PV)", short: "DV & PV", group: "Prototype & Validation", gate: "G5 · DV & PV Complete", start: M(2028, 1), end: M(2028, 7) },
  { n: 7, name: "Homologation & Type Approval", short: "Homologation", group: "Homologation", gate: "G6 · Homologation Approval", start: M(2028, 7), end: M(2029, 1) },
  { n: 8, name: "Industrialization & Production Prep", short: "Industrialization", group: "Industrialization", gate: "G7 · Industrialization Readiness", start: M(2029, 1), end: M(2029, 7) },
  { n: 9, name: "Pilot Build & Pre-SOP", short: "Pilot Build", group: "Production", gate: "G9 · Pre-SOP Approval", start: M(2029, 7), end: M(2029, 12) },
  { n: 10, name: "SOP (Start of Production)", short: "SOP / Launch", group: "Production", gate: "G10 · SOP Declaration", start: M(2029, 12), end: M(2030, 3) },
  { n: 11, name: "Mass Production & Ramp-up", short: "Mass Prod.", group: "Production", gate: "G11 · COP Approval", start: M(2030, 3), end: M(2030, 6) },
  { n: 12, name: "COP Setup & Approval", short: "COP", group: "Production", gate: "G11 · COP Approval", start: M(2030, 6), end: M(2030, 9) },
  { n: 13, name: "Market Feedback & Continuous Improvement", short: "Field Feedback", group: "Post Launch", gate: "G12 · Product Improving", start: M(2030, 9), end: M(2031, 1), ongoing: true },
]

export const AXIS_START = M(2026, 1)
export const AXIS_END = M(2031, 1) // exclusive end of the drawn axis
const SPAN = AXIS_END - AXIS_START

export const fmtMonth = (m: number) => {
  const y = 2026 + Math.floor(m / 12)
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[m % 12]} ${y}`
}
export const monthOf = (d: Date) => (d.getFullYear() - 2026) * 12 + d.getMonth()
export const pctOf = (m: number) => ((m - AXIS_START) / SPAN) * 100

export type TimelineStatus = {
  phases: (Phase & { status: PhaseStatus; progress: number })[]
  today: number
  current: Phase & { status: PhaseStatus; progress: number }
  /** The current phase's deadline = the "next step should be finished by" date. */
  nextDeadline: { phase: Phase; date: number; monthsLeft: number; gate: string }
  start: { date: number; gate: string }
  launch: { phase: Phase; date: number }
  groups: { name: string; start: number; end: number; phases: string }[]
}

export function timelineStatus(now: Date): TimelineStatus {
  const today = monthOf(now) + now.getDate() / 30 // fractional month
  const phases = PHASES.map((p) => {
    const status: PhaseStatus = today >= p.end ? "done" : today >= p.start ? "current" : "upcoming"
    const progress = status === "done" ? 1 : status === "current" ? (today - p.start) / (p.end - p.start) : 0
    return { ...p, status, progress }
  })
  const current = phases.find((p) => p.status === "current") ?? phases[phases.length - 1]
  return {
    phases,
    today,
    current,
    nextDeadline: {
      phase: current,
      date: current.end,
      monthsLeft: Math.max(0, Math.round((current.end - today) * 10) / 10),
      gate: current.gate,
    },
    start: { date: PHASES[0].start, gate: PHASES[0].gate },
    launch: { phase: PHASES.find((p) => p.n === 10)!, date: M(2030, 3) },
    groups: (() => {
      const out: TimelineStatus["groups"] = []
      for (const p of PHASES) {
        const last = out[out.length - 1]
        if (last && last.name === p.group) {
          last.end = p.end
          last.phases = `${last.phases.split("–")[0]}–${p.n}`
        } else out.push({ name: p.group, start: p.start, end: p.end, phases: `${p.n}` })
      }
      return out
    })(),
  }
}
