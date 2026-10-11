// Vehicle + market scope. Lives in the URL (?v=G60&m=EU) so every view is shareable and server-renderable.

export const VEHICLES = [
  { id: "G60", name: "5 Series", horizon: "Successor, 2030 horizon" },
  { id: "G70", name: "7 Series", horizon: "Successor, 2030 horizon" },
  { id: "F70", name: "1 Series", horizon: "Successor, 2030 horizon" },
] as const

export const MARKETS = [
  { id: "all", name: "All markets" },
  { id: "EU", name: "Europe" },
  { id: "US", name: "United States" },
  { id: "CN", name: "China" },
] as const

export type VehicleId = (typeof VEHICLES)[number]["id"]
export type MarketId = (typeof MARKETS)[number]["id"]

export const vehicleOf = (id?: string | null) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]
export const marketOf = (id?: string | null) => MARKETS.find((m) => m.id === id) ?? MARKETS[0]

/** Keep only the scope params (v, m) when linking between screens. */
export function scopeQuery(params: URLSearchParams | null) {
  if (!params) return ""
  const q = new URLSearchParams()
  for (const k of ["v", "m"]) {
    const val = params.get(k)
    if (val) q.set(k, val)
  }
  const s = q.toString()
  return s ? `?${s}` : ""
}
