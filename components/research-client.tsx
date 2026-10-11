"use client"

import { AlertTriangle, ExternalLink, Globe, Loader2, Search, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { EmptyState } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { channelOf } from "@/lib/channels"
import type { ResearchFinding, ResearchRun } from "@/lib/research"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string }

// Colour only where it means something: the relation to BMW's own customers. Everything else is neutral.
const RELATION: Record<string, { label: string; text: string; dot: string; hint: string }> = {
  agrees: { label: "Agrees with BMW customers", text: "text-observed", dot: "bg-observed", hint: "At least 20% of BMW's own comments on this feature say the same." },
  contradicts: { label: "Contradicts BMW customers", text: "text-destructive", dot: "bg-destructive", hint: "Fewer than 20% of BMW's own comments on this feature say the same." },
  new_signal: { label: "New signal", text: "text-chart-1", dot: "bg-chart-1", hint: "BMW's own feedback barely mentions this feature (fewer than 5 comments)." },
  context: { label: "Context", text: "text-muted-foreground", dot: "bg-muted-foreground", hint: "A fact without an opinion, such as a spec or a price." },
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "social", label: "Social and forums" },
  { id: "web", label: "Press and web" },
] as const

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function ResearchClient({
  vehicle,
  market,
  missions,
  depths,
  features,
  initialQuestion,
  initialRun,
}: {
  vehicle: { id: string; name: string }
  market: string
  missions: Option[]
  depths: Option[]
  features: Record<string, string>
  initialQuestion: string
  initialRun: ResearchRun | null
}) {
  const router = useRouter()
  const [mission, setMission] = useState(initialRun?.mission ?? (initialQuestion ? "free" : "competitors"))
  const [depth, setDepth] = useState(initialRun?.depth ?? "standard")
  const [question, setQuestion] = useState(initialRun?.question ?? initialQuestion)
  const [run, setRun] = useState<ResearchRun | null>(initialRun)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")

  const start = async () => {
    if (question.trim().length < 5 || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle: vehicle.id, mission, depth, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Research failed")
      setRun(data)
      router.replace(`/research?v=${vehicle.id}&m=${market}&run=${data.id}`, { scroll: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={mission} onValueChange={setMission}>
              <SelectTrigger className="w-[220px]" aria-label="Mission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {missions.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={depth} onValueChange={setDepth}>
              <SelectTrigger className="w-[210px]" aria-label="Depth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {depths.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start()
            }}
            placeholder={`What should the agent find out? e.g. "How do Mercedes E-Class and Audi A6 handle rear-seat comfort?"`}
            className="min-h-20 resize-none border-0 bg-muted/60 text-base shadow-none focus-visible:ring-2"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Planning searches, searching the web with Linkup, reading the pages, checking every quote. Usually 20 to 60 seconds."
                : "The model never browses. Linkup returns the pages, the model reads only those, and any quote not found in its page is dropped."}
            </p>
            <Button size="lg" className="rounded-full px-6" onClick={start} disabled={loading || question.trim().length < 5}>
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
              {loading ? "Researching…" : "Run research"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {run && !loading ? (
        <div className="mt-4 grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle>Findings</CardTitle>
                <CardDescription className="line-clamp-2" title={run.question}>
                  {run.question}
                </CardDescription>
              </div>
              <Provenance kind="external" />
            </CardHeader>
            <CardContent className="space-y-4">
              {run.findings.length === 0 ? (
                <EmptyState icon={Globe} title="No finding survived">
                  The pages Linkup returned did not answer the question, or no quote could be verified. See the searches and pages on the right.
                </EmptyState>
              ) : (
                <Findings run={run} features={features} filter={filter} setFilter={setFilter} />
              )}
            </CardContent>
          </Card>
          <RunLog run={run} />
        </div>
      ) : (
        !loading && (
          <Card className="mt-4">
            <CardContent>
              <EmptyState icon={Globe} title="No research run open">
                Pick a mission, ask a question, run it. Every run is saved in History.
              </EmptyState>
            </CardContent>
          </Card>
        )
      )}
    </>
  )
}

function Findings({
  run,
  features,
  filter,
  setFilter,
}: {
  run: ResearchRun
  features: Record<string, string>
  filter: (typeof FILTERS)[number]["id"]
  setFilter: (f: (typeof FILTERS)[number]["id"]) => void
}) {
  // Social and owner forums first: owners' own words are what BMW's own data lacks.
  const all = run.findings
    .map((f) => ({ f, ch: channelOf(f.source_url, f.source_type) }))
    .sort((a, b) => Number(b.ch.social) - Number(a.ch.social))
  const count = { all: all.length, social: all.filter((x) => x.ch.social).length, web: all.filter((x) => !x.ch.social).length }
  const shown = all.filter((x) => filter === "all" || (filter === "social") === x.ch.social)
  // BMW's own counts, once per feature instead of on every card.
  const ctx = new Map(run.findings.filter((f) => f.feature_id && f.bmw_context).map((f) => [f.feature_id!, f.bmw_context!]))

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setFilter(x.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === x.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label} <span className="tabular-nums opacity-60">{count[x.id]}</span>
          </button>
        ))}
      </div>
      {[...ctx].map(([id, c]) => (
        <p key={id} className="text-xs text-muted-foreground">
          BMW&apos;s own feedback on <span className="font-medium text-foreground">{features[id] ?? id}</span>: {c.positive} positive · {c.negative}{" "}
          negative · {c.want} wishes, of {c.total} comments.
        </p>
      ))}
      {shown.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {filter === "social" ? "No social or forum finding survived in this run." : "No finding in this group."}
        </p>
      ) : (
        <div className="divide-y">
          {shown.map(({ f }) => (
            <FindingCard key={f.id} f={f} features={features} />
          ))}
        </div>
      )}
    </>
  )
}

function FindingCard({ f, features }: { f: ResearchFinding; features: Record<string, string> }) {
  const ch = channelOf(f.source_url, f.source_type)
  // Only a claim about the BMW itself is compared with BMW's customers (older runs did not record this).
  const rel = f.relation && f.about_kind === "bmw" ? RELATION[f.relation] : null
  return (
    <article className="space-y-2.5 py-5 first:pt-1 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium">
          <span className={cn("size-2 rounded-full", ch.dot)} />
          {ch.label}
        </span>
        {f.about_kind === "competitor" && (
          <span className="text-muted-foreground">
            About <span className="font-medium text-foreground">{f.about}</span>
          </span>
        )}
        {f.about_kind === "market" && <span className="text-muted-foreground">Market · {f.about}</span>}
        {rel && (
          <span title={rel.hint} className={cn("inline-flex items-center gap-1.5 font-medium", rel.text)}>
            <span className={cn("size-1.5 rounded-full", rel.dot)} />
            {rel.label}
          </span>
        )}
        {f.feature_id && <span className="text-muted-foreground">{features[f.feature_id] ?? f.feature_id}</span>}
        {(f.market || f.published_date) && <span className="text-muted-foreground">{[f.market, f.published_date].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className="text-[15px] leading-snug font-medium">{f.claim}</p>
      <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">&ldquo;{f.quote}&rdquo;</blockquote>
      <a
        href={f.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {host(f.source_url)} · {f.source_name} <ExternalLink className="size-3" />
      </a>
    </article>
  )
}

function RunLog({ run }: { run: ResearchRun }) {
  const social = run.findings.filter((f) => channelOf(f.source_url, f.source_type).social).length
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">How this was found</CardTitle>
        <CardDescription>
          {new Date(run.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })} ·{" "}
          {Math.round((run.duration_ms ?? 0) / 1000)} s · {run.model} · {run.prompt_version}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            [run.linkup_calls, "searches"],
            [run.sources.length, "pages read"],
            [run.findings.length, "findings kept"],
          ].map(([n, l]) => (
            <div key={l as string}>
              <p className="text-2xl font-semibold tabular-nums">{n}</p>
              <p className="text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {social} of {run.findings.length} findings come from social media or owner forums.
        </p>
        {run.dropped.length === 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-observed/10 p-3 text-xs text-observed">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Every kept quote was found word for word in its page.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-inferred/10 p-3 text-xs text-inferred">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {run.dropped.length} finding{run.dropped.length > 1 ? "s were" : " was"} dropped: the quote was not in its page. Every kept quote was found
            word for word.
          </p>
        )}
        <section className="space-y-2.5">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Searches</h4>
          {run.queries.map((q) => (
            <div key={q.q} className="space-y-0.5 text-xs">
              <p>
                <span
                  className={cn(
                    "mr-1.5 rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
                    q.channel === "social" ? "bg-simulated/10 text-simulated" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {q.channel === "social" ? "Social" : "Web"}
                </span>
                {q.q}
              </p>
              <p className="text-muted-foreground">
                {q.error ? <span className="text-destructive">{q.error}</span> : `${q.results} results`} · {q.seconds.toFixed(1)} s · Linkup {q.depth}
              </p>
            </div>
          ))}
        </section>
        <details className="text-xs">
          <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Pages shown to the model · {run.sources.length}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {run.sources.map((s) => (
              <li key={s.sid}>
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                  [{s.sid}] {s.name}
                </a>
                <span className="text-muted-foreground"> · {host(s.url)}</span>
              </li>
            ))}
          </ul>
        </details>
        {run.dropped.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase">Dropped · {run.dropped.length}</summary>
            <ul className="mt-2 space-y-2">
              {run.dropped.map((d, i) => (
                <li key={i}>
                  <p>{d.claim}</p>
                  <p className="text-muted-foreground">
                    [{d.source_id}] {d.reason}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
