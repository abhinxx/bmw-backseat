import { ListChecks } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { marketOf, vehicleOf } from "@/lib/scope"

const COLUMNS = ["Proposed", "In review", "Approved", "Rejected"] as const

export default async function Requirements({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string }>
}) {
  const { v, m } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name}`}
        title="Requirements"
        description="AI drafts customer-facing requirements with evidence, assumptions and uncertainty. Only you approve or reject."
        action={
          <Button size="lg" className="rounded-full px-5" disabled>
            Review proposals
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((c) => (
          <Card key={c} className="gap-2 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {c}
                <span className="text-muted-foreground">0</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState icon={ListChecks} title="No requirements" className="py-8" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Each card will show: why (linked evidence), assumptions, uncertainties and conflicts, and the priority factors
        side by side. Every action is logged with time and reason.
      </p>
    </>
  )
}
