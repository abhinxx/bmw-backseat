import { Globe, Info } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { marketOf, vehicleOf } from "@/lib/scope"

const MISSIONS = ["Competitor comparison", "Reviews and press", "Owner forums and social", "Trends", "Free question"]
const DEPTHS = ["Quick", "Standard", "Deep"]

export default async function Research({
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
        title="Research Agent"
        description="Sends an analyst to the web for what BMW's own data cannot say. Every finding keeps its source link and date."
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select defaultValue={MISSIONS[0]}>
              <SelectTrigger className="w-[220px]" aria-label="Mission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSIONS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="Standard">
              <SelectTrigger className="w-[140px]" aria-label="Depth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPTHS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder={`What should the agent find out? e.g. "How do Mercedes E-Class and Audi A6 handle rear-seat comfort?"`}
            className="min-h-20 resize-none border-0 bg-muted/60 text-base shadow-none"
          />
          <div className="flex justify-end">
            <Button size="lg" className="rounded-full px-6" disabled>
              Run research
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <CardDescription>Tagged as agrees with BMW data, contradicts, or new signal.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Globe} title="No research runs yet" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" /> Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Loud is not representative. Twelve forum posts are not a market share.</p>
            <p>A competitor having a feature does not mean BMW should copy it.</p>
            <p>External signals add to BMW&apos;s evidence. They never silently replace it.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
