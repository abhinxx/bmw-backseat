import Link from "next/link"

import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Finding, outsideView } from "@/lib/data"

// Evidence links: every public item opens its own /evidence record.
const href = (id: string) => `/evidence/public/${encodeURIComponent(id)}`

const factMeta = (f: Finding) => {
  const bits: string[] = []
  if (f.value != null) bits.push(`${Number(f.value).toLocaleString("en-US")}${f.unit ? " " + f.unit : ""}`)
  if (f.year != null) bits.push(`${f.year}`)
  if (f.source_page != null) bits.push(`p. ${f.source_page}`)
  return bits.join(" · ")
}

const trendMeta = (f: Finding) => {
  const when = f.published_date ?? f.year
  return `${f.source_name}${when != null ? ` · ${when}` : ""}`
}

const COLUMN_LABEL = "text-xs font-medium tracking-wide text-muted-foreground uppercase"
const LINK_CLS = "-mx-2 block rounded-lg px-2 py-1.5 text-sm hover:bg-accent"

// Public sources shown beside BMW data, never mixed into its numbers (PLAN §2 honesty rule).
export function OutsideView({ data }: { data: Awaited<ReturnType<typeof outsideView>> }) {
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Outside view</CardTitle>
          <CardDescription>
            Public sources outside BMW: the BMW Group Report 2025, industry studies and owner forums. Shown beside BMW
            data, never mixed into its numbers.
          </CardDescription>
        </div>
        <Provenance kind="external" />
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <p className={COLUMN_LABEL}>BMW Group Report 2025</p>
          <div className="space-y-1">
            {Object.values(data.report).map((f) => (
              <Link key={f.id} href={href(f.id)} className={LINK_CLS}>
                {f.title}
                <span className="block text-xs text-muted-foreground">{factMeta(f)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className={COLUMN_LABEL}>Industry trends</p>
          <div className="space-y-1">
            {data.trends.map((f) => (
              <Link key={f.id} href={href(f.id)} className={LINK_CLS}>
                <span className="line-clamp-3">{f.title}</span>
                <span className="block text-xs text-muted-foreground">{trendMeta(f)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className={COLUMN_LABEL}>Owner voices</p>
          <div className="space-y-1">
            {data.voices.map((f) => (
              <Link key={f.id} href={href(f.id)} className={LINK_CLS}>
                <span className="line-clamp-4 italic">“{f.quote}”</span>
                <span className="block text-xs text-muted-foreground">
                  {f.source_name} · {(f.topic ?? "").replaceAll("_", " ")}
                </span>
              </Link>
            ))}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            {data.voiceCount} owner quotes collected. Loud is not representative.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
