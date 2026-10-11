"use client"

import { ExternalLink, Globe, Loader2, Search, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { EmptyState } from "@/components/page"
import { Provenance } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ResearchFinding, ResearchRun } from "@/lib/research"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string }

const RELATION: Record<string, { label: string; cls: string; hint: string }> = {
  agrees: { label: "Agrees with BMW data", cls: "bg-observed/10 text-observed", hint: "At least 20% of BMW's own comments on this feature say the same." },
  contradicts: { label: "Contradicts BMW data", cls: "bg-destructive/10 text-destructive", hint: "Fewer than 20% of BMW's own comments on this feature say the same." },
  new_signal: { label: "New signal", cls: "bg-chart-1/10 text-chart-1", hint: "BMW's own feedback barely mentions this feature (fewer than 5 comments)." },
  context: { label: "Context", cls: "bg-secondary text-muted-foreground", hint: "A fact without judgement, such as a spec or a price." },
}

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
              <SelectTrigger className="w-[160px]" aria-label="Depth">
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
                <CardDescription>{run.question}</CardDescription>
              </div>
              <Provenance kind="external" />
            </CardHeader>
            <CardContent className="space-y-3">
              {run.findings.length === 0 ? (
                <EmptyState icon={Globe} title="No finding survived">
                  The pages Linkup returned did not answer the question, or no quote could be verified. See the searches and pages on the right.
                </EmptyState>
              ) : (
                run.findings.map((f) => <FindingCard key={f.id} f={f} features={features} />)
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

function FindingCard({ f, features }: { f: ResearchFinding; features: Record<string, string> }) {
  const rel = f.relation ? RELATION[f.relation] : null
  const c = f.bmw_context
  return (
    <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {rel ? (
          <span title={rel.hint} className={cn("rounded-full px-2 py-0.5 font-medium", rel.cls)}>
            {rel.label}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-foreground/20 px-2 py-0.5 text-muted-foreground">Not matched to a feature</span>
        )}
        {f.feature_id && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{features[f.feature_id] ?? f.feature_id}</span>}
        {[f.source_type?.replaceAll("_", " "), f.market, f.published_date].filter(Boolean).map((x) => (
          <span key={x} className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            {x}
          </span>
        ))}
      </div>
      <p className="font-medium leading-snug">{f.claim}</p>
      <p className="leading-relaxed text-muted-foreground italic">&ldquo;{f.quote}&rdquo;</p>
      <a
        href={f.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {host(f.source_url)} · {f.source_name} <ExternalLink className="size-3" />
      </a>
      {c && (
        <p className="text-[11px] text-muted-foreground">
          BMW feedback on this feature: {c.positive} positive, {c.negative} negative, {c.want} wishes ({c.total} comments).
        </p>
      )}
    </div>
  )
}

function RunLog({ run }: { run: ResearchRun }) {
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
            [run.linkup_calls, "Linkup searches"],
            [run.sources.length, "pages read"],
            [run.findings.length, "findings kept"],
          ].map(([n, l]) => (
            <div key={l as string}>
              <p className="text-2xl font-semibold tabular-nums">{n}</p>
              <p className="text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-observed/10 p-3 text-xs text-observed">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          {run.dropped.length === 0
            ? "Every kept quote was found word for word in its page."
            : `${run.dropped.length} finding${run.dropped.length > 1 ? "s were" : " was"} dropped because the quote was not in its page.`}
        </p>
        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Searches</h4>
          {run.queries.map((q) => (
            <div key={q.q} className="text-xs">
              <p>{q.q}</p>
              <p className="text-muted-foreground">
                {q.error ? <span className="text-destructive">{q.error}</span> : `${q.results} results`} · {q.seconds.toFixed(1)} s · Linkup {q.depth}
                {q.include_domains ? ` · only ${q.include_domains.join(", ")}` : ""}
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
            <summary className="cursor-pointer text-xs font-semibold tracking-wide text-destructive uppercase">Dropped · {run.dropped.length}</summary>
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
