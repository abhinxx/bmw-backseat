"use client"

import { ArrowRight, Database, FileSpreadsheet, FileText, Loader2, Quote, ShieldCheck, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Provenance } from "@/components/provenance"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Evidence, Run, Verdict, VerdictRow } from "@/lib/simulate"
import { cn } from "@/lib/utils"

export type PersonaCard = {
  id: string
  name: string
  label: string
  region: string
  market: string
  avatar: string
  tier: string
  tierNote: string
  light: { label: string; dot: string; meaning: string }
}

// Flag for the persona's evidence cohort (from the market string in the persona JSON,
// never from identity_illustration - that is labelled illustration only).
const FLAG: Record<string, string> = { US: "🇺🇸", EU: "🇪🇺", China: "🇨🇳", Korea: "🇰🇷🇯🇵" }
const flagOf = (market: string) =>
  Object.entries(FLAG).find(([k]) => market.startsWith(k))?.[1] ?? "🌍"

const VERDICT: Record<Verdict, { label: string; score: number | null; cls: string; ring: string }> = {
  more_likely: { label: "More likely to buy", score: 2, cls: "bg-observed/15 text-observed", ring: "ring-observed" },
  slightly_more_likely: { label: "Slightly more likely", score: 1, cls: "bg-observed/10 text-observed", ring: "ring-observed/50" },
  no_effect: { label: "No effect", score: 0, cls: "bg-muted text-muted-foreground", ring: "ring-foreground/15" },
  slightly_less_likely: { label: "Slightly less likely", score: -1, cls: "bg-inferred/10 text-inferred", ring: "ring-inferred/60" },
  less_likely: { label: "Less likely to buy", score: -2, cls: "bg-destructive/10 text-destructive", ring: "ring-destructive" },
  not_enough_evidence: {
    label: "Not enough evidence",
    score: null,
    cls: "border border-dashed border-foreground/20 text-muted-foreground",
    ring: "ring-foreground/10 ring-dashed",
  },
}
const REGIONS = ["Americas", "Europe", "Asia"] as const

function VerdictPill({ v, className }: { v: Verdict; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", VERDICT[v].cls, className)}>
      {VERDICT[v].label}
    </span>
  )
}

export function WhatIfClient({
  vehicle,
  market,
  personas,
  suggestions,
  initialQuestion,
  initialRun,
}: {
  vehicle: { id: string; name: string }
  market: string
  personas: PersonaCard[]
  suggestions: readonly string[]
  initialQuestion: string
  initialRun: Run | null
}) {
  const router = useRouter()
  const [question, setQuestion] = useState(initialRun?.question ?? initialQuestion)
  const [run, setRun] = useState<Run | null>(initialRun)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const simulate = async (q = question) => {
    if (q.trim().length < 5 || loading) return
    setQuestion(q)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, vehicle: vehicle.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Simulation failed")
      setRun(data)
      router.replace(`/what-if?v=${vehicle.id}&m=${market}&run=${data.id}`, { scroll: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed")
    } finally {
      setLoading(false)
    }
  }

  const byPersona = new Map(run?.verdicts.map((v) => [v.persona_id, v]))
  const scored = run?.verdicts.filter((v) => VERDICT[v.verdict].score !== null) ?? []
  const pos = scored.filter((v) => VERDICT[v.verdict].score! > 0).length
  const neg = scored.filter((v) => VERDICT[v.verdict].score! < 0).length
  const nee = (run?.verdicts.length ?? 0) - scored.length
  const openPersona = personas.find((p) => p.id === open)
  const openVerdict = open ? byPersona.get(open) : undefined

  return (
    <>
      <Card className="overflow-visible">
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) simulate()
            }}
            placeholder={`Describe a change, e.g. "Make rear-seat heating standard on the next ${vehicle.name}"`}
            className="min-h-24 resize-none border-0 bg-muted/60 text-base shadow-none focus-visible:ring-2"
          />
          <div className="flex flex-wrap items-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => simulate(s)}
                disabled={loading}
                className="rounded-full bg-secondary px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
            <Button size="lg" className="ml-auto rounded-full px-6" onClick={() => simulate()} disabled={loading || question.trim().length < 5}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? "Reading the evidence…" : "Simulate"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {run && !loading && (
        <div className="mt-4 grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:grid-cols-3">
          <Card className="gap-3 lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">We read this as</p>
                <p className="text-lg font-semibold">{run.change.summary}</p>
              </div>
              <Provenance kind="simulated" />
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {run.feature_id ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">Feature: {run.feature_id.replaceAll("_", " ")}</span>
              ) : (
                <span className="text-destructive">No matching feature in the evidence map. Try naming a feature (seats, iDrive, range, driver assist…).</span>
              )}
              <span className="rounded-full bg-secondary px-2.5 py-1">{run.change.change_type.replaceAll("_", " ")}</span>
              <span>
                {new Date(run.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {run.model} · {run.prompt_version} ·
                evidence {run.evidence_hash}
              </span>
              {run.cached && (
                <span className="inline-flex items-center gap-1 rounded-full bg-observed/10 px-2.5 py-1 font-medium text-observed">
                  <ShieldCheck className="size-3.5" /> Same question, same evidence: stored answer
                </span>
              )}
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Across 9 segments</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                <span className="bg-observed" style={{ width: `${(pos / 9) * 100}%` }} />
                <span className="bg-foreground/20" style={{ width: `${((scored.length - pos - neg) / 9) * 100}%` }} />
                <span className="bg-destructive" style={{ width: `${(neg / 9) * 100}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["More likely", pos, "text-observed"],
                  ["No effect", scored.length - pos - neg, "text-foreground"],
                  ["Less likely", neg, "text-destructive"],
                  ["No evidence", nee, "text-muted-foreground"],
                ].map(([l, n, c]) => (
                  <div key={l as string}>
                    <p className={cn("text-2xl font-semibold tabular-nums", c as string)}>{n as number}</p>
                    <p className="text-muted-foreground">{l as string}</p>
                  </div>
                ))}
              </div>
              <Link
                href={`/research?v=${vehicle.id}&q=${encodeURIComponent(run.change.summary)}`}
                className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm hover:bg-accent"
              >
                Check this outside BMW <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Customer segments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nine behavioural segments for the 5 Series, built from feedback, the customer study and sales. Names and faces are illustration only.
          </p>
        </div>
        {run && <p className="text-xs text-muted-foreground">Click a segment to see every piece of evidence it was given.</p>}
      </div>

      <div className="mt-5 space-y-8">
        {REGIONS.map((region) => (
          <section key={region}>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">{region}</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {personas
                .filter((p) => p.region === region)
                .map((p, i) => {
                  const v = byPersona.get(p.id)
                  return (
                    <Card
                      key={p.id}
                      role={v ? "button" : undefined}
                      tabIndex={v ? 0 : undefined}
                      onClick={() => v && setOpen(p.id)}
                      onKeyDown={(e) => v && e.key === "Enter" && setOpen(p.id)}
                      className={cn(
                        "gap-4 transition-all",
                        v && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
                        v && !loading && "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                      )}
                      style={v ? { animationDelay: `${i * 90}ms` } : undefined}
                    >
                      <CardHeader className="flex flex-row items-center gap-3">
                        <Image
                          src={p.avatar}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className={cn("size-11 rounded-full bg-muted ring-2 ring-offset-2 ring-offset-card", v ? VERDICT[v.verdict].ring : "ring-transparent")}
                        />
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-[15px] font-semibold">{p.label}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {p.name} {flagOf(p.market)} · {p.market}
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {loading ? (
                          <div className="space-y-2">
                            <div className="h-6 w-36 animate-pulse rounded-full bg-muted" />
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                          </div>
                        ) : v ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <VerdictPill v={v.verdict} />
                              <span className="text-xs text-muted-foreground">{v.confidence} confidence</span>
                            </div>
                            {v.reaction && <p className="text-sm leading-relaxed">&ldquo;{v.reaction}&rdquo;</p>}
                            <p className="text-xs text-muted-foreground">{v.reason}</p>
                            <EvidenceCount v={v} />
                          </>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex cursor-default items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                                  <span className={`size-2 shrink-0 rounded-full ${p.light.dot}`} />
                                  {p.light.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {p.light.meaning} ({p.tier}) — {p.tierNote}
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-xs text-muted-foreground">No verdict yet</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Provenance kind="simulated" /> Verdicts are a model-based interpretation of evidence, not a customer vote. The model only sees the evidence
        listed for each segment, and any citation outside it is rejected.
      </p>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openPersona && openVerdict && <EvidencePanel persona={openPersona} v={openVerdict} />}
        </SheetContent>
      </Sheet>
    </>
  )
}

function EvidenceCount({ v }: { v: VerdictRow }) {
  const e = v.evidence
  const total = Object.values(e.totals).reduce((a, b) => a + b, 0)
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded-full bg-secondary px-2 py-0.5">
        {e.comments.length} of {total} comments
      </span>
      <span className="rounded-full bg-secondary px-2 py-0.5">{e.study.length} study items</span>
      <span className="rounded-full bg-secondary px-2 py-0.5">{e.options.length} price-list items</span>
      <span className="rounded-full bg-observed/10 px-2 py-0.5 text-observed">{v.supporting_ids.length + v.opposing_ids.length} cited</span>
      {v.dropped_citations.length > 0 && (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">{v.dropped_citations.length} rejected</span>
      )}
    </div>
  )
}

type Item = { id: string; kind: "comment" | "study" | "option"; title: string; body: string; source: string }

function items(e: Evidence): Item[] {
  return [
    ...e.comments.map((c) => ({
      id: c.id,
      kind: "comment" as const,
      title: `${c.id} · ${c.country} · ${c.engine} · ${c.sentiment}`,
      body: c.text,
      source: `Feedback workbook, Excel row ${c.excel_row}${c.taxonomy ? ` · class “${c.taxonomy}”` : ""}`,
    })),
    ...e.study.map((s) => ({
      id: s.id,
      kind: "study" as const,
      title: `${s.model} · ${s.market}`,
      body: `${s.attribute}: ${s.metric === "top2box" ? `${(s.value * 100).toFixed(1)}% top-2-box` : `${s.value.toFixed(2)} mean`}`,
      source: `Customer study, ${s.source}`,
    })),
    ...e.options.map((o) => ({
      id: o.id,
      kind: "option" as const,
      title: `${o.code} ${o.name}${o.price_eur ? ` · €${o.price_eur.toLocaleString("en-US")}` : ""}`,
      body: o.contents,
      source: `Price list Germany July 2026, page ${o.page}`,
    })),
  ]
}

const KIND_ICON = { comment: Quote, study: FileSpreadsheet, option: FileText }

function EvidenceList({ title, list, tone }: { title: string; list: Item[]; tone: string }) {
  if (!list.length) return null
  return (
    <section className="space-y-2">
      <h4 className={cn("text-xs font-semibold tracking-wide uppercase", tone)}>
        {title} · {list.length}
      </h4>
      {list.map((it) => {
        const Icon = KIND_ICON[it.kind]
        return (
          <div key={it.id} className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" /> {it.title}
            </p>
            <p className="mt-1.5 leading-relaxed">{it.body}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{it.source}</p>
          </div>
        )
      })}
    </section>
  )
}

function EvidencePanel({ persona, v }: { persona: PersonaCard; v: VerdictRow }) {
  const all = items(v.evidence)
  const sup = new Set(v.supporting_ids)
  const opp = new Set(v.opposing_ids)
  return (
    <>
      <SheetHeader className="space-y-3 border-b pb-5">
        <div className="flex items-center gap-3">
          <Image src={persona.avatar} alt="" width={48} height={48} unoptimized className="size-12 rounded-full bg-muted" />
          <div>
            <SheetTitle>{persona.label}</SheetTitle>
            <SheetDescription>
              {persona.name} · {persona.market} · evidence tier {persona.tier}
            </SheetDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VerdictPill v={v.verdict} />
          <span className="text-xs text-muted-foreground">{v.confidence} confidence</span>
        </div>
        {v.reaction && <p className="text-sm">&ldquo;{v.reaction}&rdquo;</p>}
        <p className="text-sm text-muted-foreground">{v.reason}</p>
        {v.assumptions.length > 0 && (
          <div className="rounded-xl bg-inferred/10 p-3 text-xs">
            <p className="mb-1 font-semibold text-inferred">Assumptions (forward-looking, not evidence)</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {v.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </SheetHeader>
      <div className="space-y-6 p-4">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Database className="mt-0.5 size-3.5 shrink-0" />
          {v.evidence.scope}. Selected by a fixed query (feature classes and keywords, this segment&apos;s markets), first {v.evidence.comments.length} per
          sentiment by ID. Totals: {Object.entries(v.evidence.totals).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.
          {v.llm_called ? "" : " The model was not called."}
        </p>
        {v.dropped_citations.length > 0 && (
          <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            Rejected citations (not in this segment&apos;s evidence): {v.dropped_citations.join(", ")}
          </p>
        )}
        <EvidenceList title="Supports the verdict" list={all.filter((i) => sup.has(i.id))} tone="text-observed" />
        <EvidenceList title="Argues against" list={all.filter((i) => opp.has(i.id))} tone="text-destructive" />
        <EvidenceList title="Given but not cited" list={all.filter((i) => !sup.has(i.id) && !opp.has(i.id))} tone="text-muted-foreground" />
      </div>
    </>
  )
}
