import Link from "next/link"

import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Finding } from "@/lib/data"

// Display names for the competitor ids in the findings. Anything unknown shows its id.
const NAMES: Record<string, string> = {
  "mercedes-e-class": "Mercedes E-Class",
  "audi-a6-e-tron": "Audi A6 e-tron",
  "volvo-es90": "Volvo ES90",
  "genesis-g80": "Genesis G80",
  "xiaomi-su7": "Xiaomi SU7",
}

const clip = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s)
const rowLabel = (topic: string) => {
  const s = topic.replaceAll("_", " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Feature × competitor grid from public sources; each cell links to its evidence record.
export function CompetitorMatrix({ findings, vehicleName }: { findings: Finding[]; vehicleName: string }) {
  const cells = findings.filter((f) => f.kind === "competitor_feature")
  if (cells.length === 0)
    return (
      <Card className="mt-4">
        <CardContent className="text-sm text-muted-foreground">
          No rival comparison for the {vehicleName} yet. The comparison table exists for the 5 Series only.
        </CardContent>
      </Card>
    )
  const usable = cells.filter((f) => f.topic && f.subject)
  const subjects = [...new Set(usable.map((f) => f.subject as string))]
  const topics = [...new Set(usable.map((f) => f.topic as string))]
  const at = new Map<string, Finding>()
  for (const f of usable) {
    const key = `${f.topic}|${f.subject}`
    if (!at.has(key)) at.set(key, f)
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Competitors: what they offer</CardTitle>
          <CardDescription>
            {cells.length} cells from public sources such as spec pages and reviews. Each cell links to its source.
            Cells marked not confirmed could not be verified.
          </CardDescription>
        </div>
        <Provenance kind="external" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground" />
                {subjects.map((s) => (
                  <th key={s} className="px-2 py-2 text-left font-medium text-muted-foreground">
                    {NAMES[s] ?? s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic} className="border-t">
                  <td className="px-2 py-2 align-top font-medium whitespace-nowrap">{rowLabel(topic)}</td>
                  {subjects.map((subject) => {
                    const f = at.get(`${topic}|${subject}`)
                    return (
                      <td key={subject} className="px-2 py-2 align-top">
                        {f ? (
                          <Link
                            href={`/evidence/public/${encodeURIComponent(f.id)}`}
                            title={f.title}
                            className={
                              /not confirmed/i.test(f.title) ? "italic text-muted-foreground hover:underline" : "hover:underline"
                            }
                          >
                            {clip(f.title)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
