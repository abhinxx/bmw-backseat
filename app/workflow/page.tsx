import { ClipboardList, Layers, ListChecks, Scale, Sparkles } from "lucide-react"

import { PageHeader } from "@/components/page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Boundaries } from "@/components/workflow/boundaries"
import { FunnelTiles } from "@/components/workflow/funnel"
import { ScoreMethod } from "@/components/workflow/score-method"
import { SourceHierarchy } from "@/components/workflow/hierarchy"
import { WorkflowStepper } from "@/components/workflow/stepper"
import { funnel } from "@/lib/requirements/funnel"
import { vehicleOf } from "@/lib/scope"

export const dynamic = "force-dynamic"

export default async function Workflow({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; m?: string }>
}) {
  const { v } = await searchParams
  const vehicle = vehicleOf(v)
  const counts = await funnel(vehicle.id)

  return (
    <>
      <PageHeader
        eyebrow={`${vehicle.name} · ${vehicle.id}`}
        title="Workflow"
        description="How scattered findings become a short list of requirements: what the AI does on its own, what code computes, and where only the product manager decides."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            From findings to one decision list
          </CardTitle>
          <CardDescription>The {vehicle.name} ({vehicle.id}) funnel: what goes in and what the PM ends up approving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FunnelTiles counts={counts} />
          <p className="text-xs text-muted-foreground">
            BMW&apos;s own picture: 1 billion findings, 1,000 requirements, one car. Same funnel, one car line at a time.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            Who does what
          </CardTitle>
          <CardDescription>
            Situation analysis → Structure &amp; context → Requirements definition → Prioritization → Documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowStepper />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-4 text-muted-foreground" />
            Boundaries
          </CardTitle>
          <CardDescription>Three lanes, and they do not cross.</CardDescription>
        </CardHeader>
        <CardContent>
          <Boundaries />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            How a score is built
          </CardTitle>
          <CardDescription>Factors, default weights and the rules code applies. All computed, none written by AI.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreMethod />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" />
            Source hierarchy
          </CardTitle>
          <CardDescription>Which evidence counts more, in BMW&apos;s own ordering.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceHierarchy />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Where this sits in vehicle development</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Backseat supports stage 1 (market research and needs analysis) and stage 2 (product planning), leading into
            gate G0 (project approval) and gate G1 (concept freeze). Later gates refine and freeze requirements; every
            decision made here stays traceable.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
