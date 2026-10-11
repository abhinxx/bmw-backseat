import type { Bucket, ThemeRow } from "./data"
import type { MarketId } from "./scope"
import { FEATURES } from "./features"

const LABELS: Record<string, string> = {
  "Body equipment, overall technology": "Body & equipment",
  "ConnectedDrive and Infotainment, overall technology": "Connected services",
  "Drive, driving dynamics and chassis, overall technology": "Driving dynamics",
  "Touch screen, operation": "Touchscreen controls",
  "Operating concept, operating system": "iDrive & menus",
  "non-contact trunk lid opening": "Hands-free boot opening",
  "Public charging / external providers": "Public charging",
  "Charge high-voltage battery": "Battery charging",
  "Manage / pair mobile device (Bluetooth)": "Phone pairing",
  "Seating, ventilate / heat": "Seat heating & ventilation",
  "My BMW App / MINI App": "My BMW App",
  "Handling / Riding": "Handling & ride",
  "Electric Range": "Electric range",
}

export function rankTopics(rows: ThemeRow[], sentiment: ThemeRow["sentiment"]) {
  return rows.filter((r) => r.sentiment === sentiment && r.comments > 0)
    .sort((a, b) => b.comments - a.comments || a.level2.localeCompare(b.level2))
    .map((r) => ({ ...r, label: LABELS[r.level2] ?? r.level2, featureId: FEATURES.find((f) => f.level2.includes(r.level2))?.id ?? null }))
}

export type Topic = ReturnType<typeof rankTopics>[number]

export type Snapshot = {
  sales2025: Record<Bucket, number>
  sales2030: Record<Bucket, number>
  feedbackBy: Record<Bucket, number>
  satisfaction: { market: "EU" | "CN"; value: number; cell: string }[]
}

export function scopeSnapshot(d: Snapshot, market: MarketId) {
  const sum = (values: Record<Bucket, number>) => Object.values(values).reduce((a, b) => a + b, 0)
  return {
    comments: market === "all" ? sum(d.feedbackBy) : d.feedbackBy[market],
    sales: market === "all" ? sum(d.sales2025) : d.sales2025[market],
    forecast: market === "all" ? sum(d.sales2030) : d.sales2030[market],
    satisfaction: d.satisfaction.filter((s) => market === "all" || s.market === market),
  }
}
