import { Info } from "lucide-react"

import { CompetitorMatrix } from "@/components/competitor-matrix"
import { PageHeader } from "@/components/page"
import { ResearchClient } from "@/components/research-client"
import { Card, CardContent } from "@/components/ui/card"
import { allFindings } from "@/lib/data"
import { FEATURES } from "@/lib/features"
import { DEPTHS, loadResearchRun, MISSIONS } from "@/lib/research"
import { marketOf, vehicleOf } from "@/lib/scope"

export default async function Research({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string; q?: string; run?: string }>
}) {
  const { v, m, q, run } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)
  const [{ findings }, initialRun] = await Promise.all([
    allFindings(),
    run && /^[0-9a-f-]{36}$/.test(run) ? loadResearchRun(run) : Promise.resolve(null),
  ])

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name}`}
        title="Research Agent"
        description="Sends an analyst to the web for what BMW's own data cannot say. Every finding keeps its source link and a quote checked against the page."
      />

      <ResearchClient
        vehicle={{ id: vehicle.id, name: vehicle.name }}
        market={market.id}
        missions={Object.entries(MISSIONS).map(([id, x]) => ({ id, label: x.label, hint: x.hint.charAt(0).toUpperCase() + x.hint.slice(1) }))}
        depths={Object.entries(DEPTHS).map(([id, x]) => ({ id, label: `${x.label} · ${x.queries} search${x.queries > 1 ? "es" : ""}`, hint: x.hint }))}
        features={Object.fromEntries(FEATURES.map((f) => [f.id, f.name]))}
        initialQuestion={q ?? ""}
        initialRun={initialRun}
      />

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Info className="size-4 text-muted-foreground" /> Guardrails
          </p>
          <p>Loud is not representative. Twelve forum posts are not a market share.</p>
          <p>A competitor having a feature does not mean BMW should copy it.</p>
          <p>External signals add to BMW&apos;s evidence. They never silently replace it.</p>
        </CardContent>
      </Card>

      <CompetitorMatrix findings={findings.filter((f) => f.source_id === `competitors_${vehicle.id.toLowerCase()}`)} vehicleName={vehicle.name} />
    </>
  )
}
