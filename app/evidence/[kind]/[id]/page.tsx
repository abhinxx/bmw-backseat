import { Fragment } from "react"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEvidence } from "@/lib/evidence"

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>
}) {
  const { kind, id } = await params
  const ev = await getEvidence(kind, decodeURIComponent(id))
  if (!ev) notFound()

  return (
    <>
      <PageHeader
        eyebrow={`Evidence · ${ev.kind}`}
        title={ev.title}
        description="The raw record, exactly as stored, and where it came from."
      />
      <Card>
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {ev.body && <p className="text-base leading-relaxed">{ev.body}</p>}
          {ev.fields.length > 0 && (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              {ev.fields.map(([label, value]) => (
                <Fragment key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
            </dl>
          )}
          <div className="text-sm">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Source</span>
              <Provenance kind="observed" />
            </p>
            <p className="mt-1">{ev.source.label}</p>
            {ev.source.url && (
              <a href={ev.source.url} target="_blank" rel="noreferrer" className="mt-1 block break-all underline">
                {ev.source.url}
              </a>
            )}
          </div>
          {ev.extra && ev.extra.rows.length > 0 && (
            <div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {ev.extra.columns.map((c) => (
                      <th key={c} className="py-1 pr-4 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ev.extra.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 pr-4 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
