// "Market context: sales vs. voice" — deliberately last and visually quiet: BMW's own product
// signals come first, this is context only.
import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BUCKETS, type Bucket } from "@/lib/data"

const k = (x: number) => (x >= 1000 ? `${Math.round(x / 1000)}k` : x.toLocaleString("en-US"))
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const sum = (r: Record<Bucket, number>) => Object.values(r).reduce((a, b) => a + b, 0)

export function MarketContext({
  marketName,
  salesHere,
  forecastHere,
  soldHere,
  sales2025,
  feedbackBy,
}: {
  marketName: string
  salesHere: number
  forecastHere: number
  soldHere: boolean
  sales2025: Record<Bucket, number>
  feedbackBy: Record<Bucket, number>
}) {
  const salesTotal = sum(sales2025)
  const fbTotal = sum(feedbackBy)
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Market context: sales vs. voice</CardTitle>
          <CardDescription>
            {marketName}: {soldHere ? `${k(salesHere)} sold in 2025, ${k(forecastHere)} forecast for 2030.` : "Not sold in this market."}
            Bar shares below are for all markets: sales next to customer comments.
          </CardDescription>
        </div>
        <Provenance kind="calculated" />
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((b) => {
          const s = pct(sales2025[b.id], salesTotal)
          const f = pct(feedbackBy[b.id], fbTotal)
          return (
            <div key={b.id} className="space-y-1.5">
              <p className="text-xs font-medium">{b.name}</p>
              {[
                { label: "Sales", v: s, cls: "bg-chart-1" },
                { label: "Feedback", v: f, cls: "bg-chart-4" },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-muted-foreground">{bar.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className={`block h-full rounded-full ${bar.cls}`} style={{ width: `${bar.v}%` }} />
                  </span>
                  <span className="w-9 text-right tabular-nums">{bar.v}%</span>
                </div>
              ))}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
