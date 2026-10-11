import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { RequirementActions } from "@/components/requirements/actions"
import { AuditTrail } from "@/components/requirements/audit-trail"
import { EvidenceList } from "@/components/requirements/evidence-list"
import { ExportMenu } from "@/components/requirements/export-menu"
import { FactorTable } from "@/components/requirements/factor-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EVIDENCE_LEVELS, KIND_LABEL, STATUS_LABEL } from "@/lib/requirements/config"
import { getRequirement } from "@/lib/requirements/data"
import { PRIORITY_CLS, STATUS_CLS, when } from "@/lib/requirements/ui"
import { marketOf, vehicleOf } from "@/lib/scope"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function RequirementDetail({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<{ v?: string; m?: string }>
}) {
  const { code } = await params
  const { v, m } = await searchParams
  const result = await getRequirement(code)
  if (!result) notFound()
  const { req, events } = result
  const market = marketOf(m)
  if (v && vehicleOf(v).id !== req.vehicle) redirect(`/requirements?v=${vehicleOf(v).id}&m=${market.id}`)
  const vehicle = vehicleOf(req.vehicle)
  const scope = `v=${req.vehicle}&m=${market.id}`
  const priority = req.priority_override ?? req.priority
  const tables = [...new Set([
    "feedback_comment", "feedback_label", "study_metric", "option_item", "sales_volume",
    ...req.factors.filter((f) => f.included).flatMap((f) => f.source.split(",").map((s) => s.trim().split(" ")[0])),
    ...(req.sources.some((s) => s.kind === "csv") ? ["requirement_run.csv_rows (PM upload, unverified)"] : []),
  ])]

  return (
    <>
      <Link href={`/requirements?${scope}`} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Requirements</Link>
      <PageHeader eyebrow={`${req.code} · ${vehicle.name} · ${vehicle.horizon}`} title={req.title}
        description={req.description} action={<ExportMenu requirements={[req]} vehicle={req.vehicle} />} />
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", STATUS_CLS[req.status])}>{STATUS_LABEL[req.status]}</span>
        <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", PRIORITY_CLS[priority])}>{priority}{req.priority_override && " ✎ PM override"}</span>
        <span>{KIND_LABEL[req.kind].label} · {req.markets.join(" / ") || "No market signal yet"}</span>
        <span className="text-muted-foreground">Evidence {req.evidence_level} · {EVIDENCE_LEVELS[req.evidence_level]}</span>
        <Provenance kind="simulated" />
      </div>
      <RequirementActions requirement={req} />
      {req.status_reason && <p className="mt-3 text-sm"><span className="text-muted-foreground">Decision reason: </span>{req.status_reason}</p>}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Why this requirement</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
            <p>{req.rationale || "AI rationale withheld: inspect the calculated factors and source records before deciding."}</p>
            <div><p className="font-medium">Measurable target · forward-looking assumption</p><p className="mt-1 text-muted-foreground">{req.target || "No measurable target drafted yet. Set one during human review."}</p></div>
            {req.edited_by_pm && <p className="text-xs text-muted-foreground">PM-edited text. Later AI runs cannot overwrite it.</p>}
          </CardContent></Card>
          <div><h2 className="mb-3 text-base font-semibold">Priority factors</h2><FactorTable factors={req.factors} score={req.score} /></div>
          <Card><CardHeader><CardTitle>Assumptions</CardTitle></CardHeader><CardContent className="text-sm">
            <p className="mb-2 text-xs text-muted-foreground">Forward-looking, not observed customer evidence.</p>
            <Notes items={req.assumptions} empty="No assumptions drafted. Resolve these before approving." />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Uncertainties and conflicts</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <h3 className="font-medium">Uncertainties</h3><Notes items={req.uncertainties} empty="No uncertainty listed; this does not prove certainty." />
            <h3 className="font-medium">Conflicting signals</h3><Notes items={req.conflicts} empty="No conflict detected by the current rules." />
          </CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Linked evidence</CardTitle></CardHeader><CardContent><EvidenceList sources={req.sources} /></CardContent></Card>
      </div>
      <details className="mt-6 rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Built from · source tables and versions</summary>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>Tables used: {tables.join(", ")}</p>
          <p>Requirement version {req.version} · updated {when(req.updated_at)} CEST/CET · run {req.run_id ?? "not recorded"}</p>
          <p>Code groups and scores. The AI drafts text and citations. The PM alone decides. Uploaded CSV never contributes to the score.</p>
        </div>
      </details>
      <section className="mt-6"><h2 className="mb-3 text-base font-semibold">Audit trail</h2><AuditTrail events={events} /></section>
    </>
  )
}

function Notes({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="list-disc space-y-2 pl-5">{items.map((text, i) => <li key={i}>{text}</li>)}</ul> : <p className="text-muted-foreground">{empty}</p>
}
