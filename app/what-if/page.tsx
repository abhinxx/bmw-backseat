import { PageHeader } from "@/components/page"
import { WhatIfClient, type PersonaCard } from "@/components/what-if-client"
import { SUGGESTED_WHAT_IFS } from "@/lib/nav"
import { EVIDENCE_LIGHT, PERSONAS } from "@/lib/personas"
import { marketOf, vehicleOf } from "@/lib/scope"
import { loadRun } from "@/lib/simulate"

export default async function WhatIf({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string; q?: string; run?: string }>
}) {
  const { v, m, q, run } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)
  const initialRun = run && /^[0-9a-f-]{36}$/.test(run) ? await loadRun(run) : null

  const personas: PersonaCard[] = PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    label: p.label,
    region: p.region,
    market: p.market,
    avatar: p.avatar,
    tier: p.tier,
    tierNote: p.tierNote,
    light: EVIDENCE_LIGHT[p.light],
  }))

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id} · ${market.name}`}
        title="What-If Studio"
        description="Propose a change. Each customer segment reacts on a fixed scale, citing the BMW evidence for and against."
      />
      <WhatIfClient
        vehicle={{ id: vehicle.id, name: vehicle.name }}
        market={market.id}
        personas={personas}
        suggestions={SUGGESTED_WHAT_IFS}
        initialQuestion={q ?? ""}
        initialRun={initialRun}
      />
    </>
  )
}
