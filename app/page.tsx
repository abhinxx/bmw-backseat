import { MissionOverview } from "@/components/dashboard/mission-control"
import { fmtMonth, timelineStatus } from "@/lib/product-timeline"
import { OutsideView } from "@/components/outside-view"
import { WhatChanged } from "@/components/what-changed"
import { missionControl, outsideView } from "@/lib/data"
import { missionQuotes } from "@/lib/mission-evidence"
import { rankTopics } from "@/lib/mission-view"
import { featureFindings } from "@/lib/history"
import { MARKETS, marketOf, vehicleOf, type MarketId } from "@/lib/scope"
import { listRequirements } from "@/lib/requirements/data"
import { openRequirementCount } from "@/lib/requirements/ui"

export default async function MissionControl({ searchParams }: {
  searchParams: Promise<{ v?: string; m?: string }>
}) {
  const { v, m } = await searchParams
  const vehicle = vehicleOf(v)
  const market = marketOf(m)
  const scope = `v=${vehicle.id}&m=${market.id}`
  const [data, outside, signals, requirements] = await Promise.all([
    missionControl(vehicle.id, market.id),
    outsideView(vehicle.id, market.id),
    featureFindings(vehicle.id, 6),
    listRequirements(vehicle.id),
  ])
  const themeNames = (["negative", "want", "positive"] as const)
    .flatMap((sentiment) => rankTopics(data.themes, sentiment).slice(0, 6).map((topic) => topic.level2))
  const quotes = await missionQuotes(vehicle.id, market.id, themeNames)
  const plan = timelineStatus(new Date())
  return <MissionOverview key={scope} vehicle={vehicle} market={market} data={data}
    quotes={quotes} voices={outside.voices} signals={signals} trends={outside.trends}
    requirementsByMarket={Object.fromEntries(MARKETS.map((m) => [m.id, openRequirementCount(requirements, m.id)])) as Record<MarketId, number>}
    sources={<><div className="space-y-3 text-sm text-muted-foreground">
      <p>BMW internal feedback has no dates or demographics. There are no China or Germany comments in the internal snapshot. External owner quotes are a separate source.</p>
      <p>Non-US internal feedback comes from a single source. Studies have no sample sizes or stated satisfaction scale. Treat their means as source values, not a score out of ten.</p>
      <p>Sales are the supplied BMW snapshot. 2030 is a forecast, not an observed result. A behavioural segment is not a real person or a measured share of buyers.</p>
    </div><OutsideView data={outside} vehicleId={vehicle.id} vehicleName={vehicle.name} marketId={market.id} /></>}
    activity={<WhatChanged vehicle={vehicle.id} scope={scope} />}
    timeline={<div className="space-y-7 pt-5"><p className="text-sm text-muted-foreground">Illustrative planning context. BMW&apos;s supplied evidence contains no programme dates.</p>
      <div><p className="mc-eyebrow">CURRENT PHASE</p><h3 className="mt-2 text-xl">{plan.current.name}</h3></div>
      <div><p className="mc-eyebrow">NEXT GATE · {fmtMonth(plan.nextDeadline.date)}</p><h3 className="mt-2 text-xl">{plan.nextDeadline.gate}</h3></div>
      <div><p className="mc-eyebrow">ILLUSTRATIVE START OF PRODUCTION</p><h3 className="mt-2 text-xl">{fmtMonth(plan.launch.date)}</h3></div>
    </div>}
  />
}
