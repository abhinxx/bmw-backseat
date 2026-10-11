import Link from "next/link"

import { Provenance } from "@/components/provenance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { outsideView } from "@/lib/data"

// Evidence links: every public item opens its own /evidence record.
const href = (id: string) => `/evidence/public/${encodeURIComponent(id)}`

const factMeta = (f: { title: string; value: number | null; unit: string | null; year: number | null; source_page: number | null }) => {
  const bits: string[] = []
  if (f.value != null) bits.push(`${Number(f.value).toLocaleString("en-US")}${f.unit ? " " + f.unit : ""}`)
  if (f.year != null) bits.push(`${f.year}`)
  if (f.source_page != null) bits.push(`p. ${f.source_page}`)
  return bits.join(" · ")
}

const trendMeta = (f: { source_name: string | null; published_date: string | null; year: number | null }) => {
  const when = f.published_date ?? f.year
  return `${f.source_name}${when != null ? ` · ${when}` : ""}`
}

const hostOf = (url: string | null) => (url ?? "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0]

const COLUMN_LABEL = "text-xs font-medium tracking-wide text-muted-foreground uppercase"
const LINK_CLS = "-mx-2 block rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
const CHIP = "inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"

// Public sources shown beside BMW data, never mixed into its numbers (PLAN §2 honesty rule).
// Content follows the selected car line and market (see outsideView in lib/data.ts).
export function OutsideView({
  data,
  vehicleId,
  vehicleName,
  marketId,
}: {
  data: Awaited<ReturnType<typeof outsideView>>
  vehicleId: string
  vehicleName: string
  marketId: string
}) {
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Outside view · {vehicleName}</CardTitle>
          <CardDescription>
            Public sources outside BMW: the BMW Group Report 2025, industry studies and owner forums for this car line.
            Shown beside BMW data, never mixed into its numbers.
          </CardDescription>
        </div>
        <Provenance kind="external" />
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-2">
          <p className={COLUMN_LABEL}>BMW Group Report 2025</p>
          <div className="space-y-1">
            {data.report.map((f) => (
              <Link key={f.id} href={href(f.id)} className={LINK_CLS}>
                {/* subject says WHAT was counted (China, BMW 5 Series/6 Series, BEV share); title is the report's generic table name */}
                {f.subject ? `${f.subject}: ${f.title.toLowerCase()}` : f.title}
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
          {data.voices.length === 0 ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-sm text-muted-foreground">No owner quotes collected for the {vehicleName} yet.</p>
              <Link href={`/research?v=${vehicleId}&m=${marketId}`} className="text-sm font-medium text-primary hover:underline">
                Run a social research
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {data.voices.map((f) => (
                <Link key={f.id} href={href(f.id)} className={LINK_CLS}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-4 italic">
                      “{f.quote_translation ?? f.quote}”
                    </span>
                    <span className={CHIP}>{f.region === "US" ? "US forums" : f.region}</span>
                  </span>
                  {f.quote_translation && f.quote && (
                    <>
                      <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">Translated</span>
                      <span className="line-clamp-2 block text-[11px] text-muted-foreground">{f.quote}</span>
                    </>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {hostOf(f.source_url) || f.source_name} · {(f.topic ?? "").replaceAll("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {data.voiceCount > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              {data.voiceCount} owner quotes collected for the {vehicleName}. Loud is not representative.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
