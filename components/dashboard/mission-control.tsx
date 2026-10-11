"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition, type CSSProperties, type ReactNode } from "react"
import { ArrowRight, ArrowUpRight, Armchair, BatteryCharging, CarFront, Check, ChevronDown, CircleHelp, Gauge, Globe2, Layers3, MessageCircle, MousePointer2, Quote, Smartphone, SlidersHorizontal } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MARKETS, VEHICLES, type MarketId, type VehicleId } from "@/lib/scope"
import type { Bucket, ThemeRow } from "@/lib/data"
import { rankTopics, scopeSnapshot, type Snapshot, type Topic } from "@/lib/mission-view"
import type { TopicQuote } from "@/lib/mission-evidence"
import type { OwnerVoice, Finding } from "@/lib/data"
import type { FeedFinding } from "@/lib/history"
import { featureOf } from "@/lib/features"
import "./mission-control.css"

const ART: Partial<Record<VehicleId, string>> = { G60: "/vehicles/5-series.webp", G70: "/vehicles/7-series.webp", F70: "/vehicles/1-series.webp" }
const number = (value: number) => value.toLocaleString("en-US")
const percent = (part: number, total: number) => total ? Math.round(part / total * 100) : 0
const sum = (values: Record<Bucket, number>) => Object.values(values).reduce((a, b) => a + b, 0)
const countryName = (value: string | null) => value ? new Intl.DisplayNames(["en"], { type: "region" }).of(value) ?? value : "Country not recorded"
const hostname = (value: string | null) => { try { return new URL(value ?? "").hostname.replace(/^www\./, "") } catch { return "Source" } }
const MODES = [{ id: "negative", name: "Problems", verb: "problem" }, { id: "want", name: "Wants", verb: "request" }, { id: "positive", name: "What works", verb: "positive" }] as const
const POINTS = [{ id: "US", x: 25, y: 31 }, { id: "EU", x: 52, y: 22 }, { id: "CN", x: 79, y: 32 }] as const

function TopicIcon({ topic, className }: { topic: Topic; className?: string }) {
  const Icon = topic.featureId === "ev_range_charging" ? BatteryCharging : topic.featureId === "front_seats" || topic.featureId === "rear_comfort" ? Armchair : topic.featureId === "smartphone_app" ? Smartphone : topic.featureId === "driving_dynamics" ? Gauge : topic.featureId === "controls" ? SlidersHorizontal : CarFront
  return <Icon className={className} strokeWidth={1.25} aria-hidden="true" />
}

export type MissionProps = {
  vehicle: (typeof VEHICLES)[number]
  market: (typeof MARKETS)[number]
  data: Snapshot & { themes: ThemeRow[] }
  quotes: Record<string, TopicQuote[]>
  voices: OwnerVoice[]
  signals: FeedFinding[]
  trends: Finding[]
  requirementsByMarket: Record<MarketId, number>
  sources: ReactNode
  activity: ReactNode
  timeline: ReactNode
}

export function MissionOverview({ vehicle, market, data, quotes, voices, signals, trends, requirementsByMarket, sources, activity, timeline }: MissionProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [mode, setMode] = useState<ThemeRow["sentiment"]>("negative")
  const [topic, setTopic] = useState<Topic | null>(null)
  const view = scopeSnapshot(data, market.id)
  const scope = `v=${vehicle.id}&m=${market.id}`
  const topics = rankTopics(data.themes, mode).slice(0, 6)
  const totalFeedback = sum(data.feedbackBy), totalSales = sum(data.sales2025)
  const usShare = percent(data.feedbackBy.US, totalFeedback)
  const art = ART[vehicle.id]
  const activeMode = MODES.find((m) => m.id === mode)!
  const heroVoice = voices[0]
  const changeScope = (v: VehicleId, m: MarketId) => {
    if (v === vehicle.id && m === market.id) { setChooserOpen(false); return }
    setChooserOpen(false)
    startTransition(() => router.replace(`/?v=${v}&m=${m}`, { scroll: false }))
  }
  const themeQuote = (t: Topic) => quotes[t.level2]?.find((q) => q.sentiment === mode)
  const matchedSignals = topic?.featureId ? signals.filter((f) => f.feature_id === topic.featureId) : []

  return (
    <main className="mission-control" data-testid="mission-view" data-vehicle={vehicle.id} data-market={market.id} aria-busy={pending}>
      <div className="mc-toolbar">
        <Sheet open={chooserOpen} onOpenChange={setChooserOpen}>
          <SheetTrigger asChild>
            <button className="mc-vehicle-chooser" data-testid="vehicle-chooser" disabled={pending}>
              <span className="mc-chooser-thumbnail">{art ? <Image src={art} alt="" fill sizes="110px" /> : <CarFront strokeWidth={1} />}</span>
              <span><span className="mc-eyebrow">YOUR VEHICLE</span><strong>BMW {vehicle.name}</strong><span className="mc-chooser-meta">{vehicle.id} <span>·</span> Change vehicle</span></span>
              <ChevronDown size={19} />
            </button>
          </SheetTrigger>
          <SheetContent side="top" className="mc-garage">
            <SheetHeader><p className="mc-eyebrow">YOUR WORKSPACE, YOUR VEHICLE</p><SheetTitle>Which BMW are we shaping?</SheetTitle><SheetDescription>Choose a vehicle. Its customer evidence, market picture and studies come with it.</SheetDescription></SheetHeader>
            <div className="mc-garage-grid">{VEHICLES.map((car) => <button key={car.id} className="mc-garage-car" data-testid={`choose-${car.id}`} aria-pressed={car.id === vehicle.id} onClick={() => changeScope(car.id, market.id)} disabled={pending}>
              <span className="mc-garage-art">{ART[car.id] ? <Image src={ART[car.id]!} alt={`Illustrative BMW ${car.name} render`} fill sizes="(max-width: 700px) 80vw, 32vw" /> : <span className="mc-no-render"><CarFront size={68} strokeWidth={0.8} /><span>Vehicle image coming next</span></span>}</span>
              <span className="mc-garage-name"><strong>{car.name}</strong>{car.id === vehicle.id ? <Check size={22} /> : <ArrowUpRight size={22} />}</span><span className="mc-chooser-meta">{car.id} · Customer intelligence</span>
            </button>)}</div>
            <p className="mc-garage-note">Car renders are AI-generated illustrations, not successor designs or exact equipment specifications.</p>
          </SheetContent>
        </Sheet>
        <div className="mc-market-switch"><p className="mc-eyebrow">EXPLORE A MARKET</p><div className="mc-segmented" aria-label="Market">{MARKETS.map((m) => <button key={m.id} data-testid={`market-${m.id}`} aria-pressed={market.id === m.id} onClick={() => changeScope(vehicle.id, m.id)} disabled={pending}>{m.id === "US" ? "US" : m.name}</button>)}</div></div>
      </div>

      <section className={`mc-scene ${pending ? "mc-updating" : ""}`} aria-labelledby="vehicle-title">
        <div className="mc-scene-heading"><div><p className="mc-eyebrow">MISSION CONTROL <span> / </span> {market.name.toUpperCase()}</p><h1 id="vehicle-title">The BMW {vehicle.name}.</h1><p>Understand today. Shape what comes next.</p></div><Link className="mc-primary" href={`/what-if?${scope}`}>Explore a what-if <ArrowRight size={16} /></Link></div>
        <div className="mc-orbit mc-feedback"><span className="mc-orbit-label"><MessageCircle size={14} /> Customer voices</span><strong data-testid="comment-count">{number(view.comments)}</strong><span>unique internal comments</span>{market.id === "all" && usShare > 80 ? <small className="mc-warning">{usShare}% from the US</small> : <small>{market.name}</small>}</div>
        <div className="mc-orbit mc-study" data-testid="study-summary"><span className="mc-orbit-label">Customer study</span>{view.satisfaction.length ? <div className="mc-study-values">{view.satisfaction.map((s) => <Link key={s.market} href={`/evidence/study/${encodeURIComponent(s.cell)}`}><strong>{s.value.toFixed(1)}</strong><span>{s.market === "EU" ? "Europe" : "China"}</span></Link>)}</div> : <p className="mc-no-score">No comparable study mean</p>}<small>Observed mean · scale not stated</small></div>
        <div className="mc-car-stage" key={vehicle.id}>{art ? <Image className="mc-vehicle-image" src={art} alt={`AI-generated ${vehicle.name} illustration`} fill sizes="(max-width: 700px) 95vw, (max-width: 1200px) 70vw, 900px" preload /> : <div className="mc-car-placeholder"><CarFront size={100} strokeWidth={0.8} /><p>BMW 1 Series</p><span>A matching render is needed. Real evidence is available below.</span></div>}</div>
        <div className="mc-scene-bottom"><div><span className="mc-eyebrow">2025 SALES <span> / </span> {market.name.toUpperCase()}</span><strong>{number(view.sales)} <span>vehicles</span></strong></div><div className="mc-horizon"><span className="mc-eyebrow">LOOKING AHEAD</span><strong>2030 <span>planning horizon</span></strong></div></div>
        <p className="mc-image-note">AI-generated vehicle illustration · not a successor specification</p>
      </section>

      <section className="mc-topics-section" aria-labelledby="topics-title">
        <div className="mc-section-heading"><div><p className="mc-eyebrow">THE CUSTOMER PICTURE</p><h2 id="topics-title">What deserves a closer look?</h2></div><div className="mc-segmented mc-mode" aria-label="Feedback type">{MODES.map((m) => <button key={m.id} data-testid={`sentiment-${m.id}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.name}</button>)}</div></div>
        {topics.length ? <div className="mc-topic-grid">{topics.map((t, i) => <button key={`${mode}:${t.level2}`} className="mc-topic-card" data-testid={`topic-${mode}-${i}`} onClick={() => setTopic(t)}>
          <span className="mc-topic-top"><span className="mc-topic-index">{String(i + 1).padStart(2, "0")}</span><TopicIcon topic={t} /></span><h3>{t.label}</h3><span className="mc-topic-count"><strong>{number(t.comments)}</strong><span>{activeMode.verb} comments</span><ArrowUpRight size={17} /></span>
        </button>)}</div> : <div className="mc-empty"><CircleHelp size={25} /><h3>No internal feedback for {market.name}</h3><p>This is an evidence gap, not an absence of customer needs.</p><Link href={`/research?${scope}`}>Explore outside signals <ArrowRight size={15} /></Link></div>}
        <p className="mc-caption">Calculated from BMW taxonomy labels. A comment can appear in multiple themes. Select a topic to inspect its evidence.</p>
      </section>

      <section className="mc-landscape" aria-labelledby="market-title">
        <div className="mc-map-panel"><div className="mc-section-heading"><div><p className="mc-eyebrow">A GLOBAL PERSPECTIVE</p><h2 id="market-title">Where we sell.<br />Who we hear.</h2></div><Globe2 size={24} strokeWidth={1} /></div>
          <div className="mc-world" role="group" aria-label="Select a market on the world map"><div className="mc-world-land" />{POINTS.map((p) => {
            const salesShare = percent(data.sales2025[p.id], totalSales), voiceShare = percent(data.feedbackBy[p.id], totalFeedback)
            return <button key={p.id} className="mc-map-marker" style={{ left: `${p.x}%`, top: `${p.y}%`, "--sales-size": `${Math.sqrt(salesShare / 100) * 84}px`, "--voice-size": `${Math.sqrt(voiceShare / 100) * 84}px` } as CSSProperties} aria-label={`${p.id === "EU" ? "Europe" : p.id === "US" ? "United States" : "China"}: ${salesShare}% of sales, ${voiceShare}% of feedback`} aria-pressed={market.id === p.id} onClick={() => changeScope(vehicle.id, p.id)} disabled={pending}><span className="mc-map-sales" /><span className="mc-map-voice" /><span className="mc-map-label">{p.id === "EU" ? "Europe" : p.id === "US" ? "US" : "China"}</span></button>
          })}</div>
          <div className="mc-map-legend"><span><i className="mc-sales-dot" /> 2025 sales</span><span><i className="mc-voice-dot" /> Internal feedback</span><small>Circle area represents share</small></div>
          <div className="mc-market-pairs">{MARKETS.filter((b) => b.id !== "all").map((b) => <button key={b.id} aria-pressed={market.id === b.id} onClick={() => changeScope(vehicle.id, b.id as MarketId)} disabled={pending}><span>{b.id === "US" ? "United States" : b.name}</span><strong>{percent(data.sales2025[b.id], totalSales)}% <span>sales</span></strong><strong>{percent(data.feedbackBy[b.id], totalFeedback)}% <span>feedback</span></strong></button>)}</div>
          <p className="mc-caption">Global context for this vehicle, even with a market selected. Rest of world: {percent(data.sales2025.RoW, totalSales)}% sales / {percent(data.feedbackBy.RoW, totalFeedback)}% feedback. Geography: Natural Earth.</p>
        </div>
        <div className="mc-voice-panel"><p className="mc-eyebrow">OUTSIDE BMW <span> / </span> OWNER VOICE</p>{heroVoice ? <><Quote size={32} strokeWidth={1} className="mc-quote-mark" /><blockquote>“{heroVoice.quote_translation ?? heroVoice.quote}”</blockquote><div className="mc-voice-source"><span>{heroVoice.region} · {hostname(heroVoice.source_url)}</span><Link href={`/evidence/public/${encodeURIComponent(heroVoice.id)}`}>Inspect source <ArrowUpRight size={15} /></Link></div><p className="mc-caption">{heroVoice.quote_translation ? "Translated. " : ""}An individual public account, not a representative customer survey.</p></> : <><h3>The outside picture is still developing.</h3><p>No owner quotes collected for this vehicle and market yet.</p><Link className="mc-text-link" href={`/research?${scope}`}>Investigate this market <ArrowRight size={16} /></Link></>}
          <div className="mc-coverage-note"><CircleHelp size={18} /><div><strong>Know the limits.</strong><p>{market.id === "CN" ? "No China feedback in the internal snapshot. Studies, sales and external voices are different evidence types." : market.id === "all" ? `${usShare}% of internal feedback is US-based. Global sales do not mean global customer coverage.` : `${number(view.comments)} internal comments for ${market.name}. Do not generalise this sample to every customer.`}</p></div></div>
        </div>
      </section>

      <section className="mc-signals" aria-labelledby="signals-title"><div className="mc-section-heading"><div><p className="mc-eyebrow">THE WORLD KEEPS MOVING</p><h2 id="signals-title">Signals beyond the snapshot.</h2></div><Link className="mc-text-link" href={`/research?${scope}`}>Explore research <ArrowUpRight size={16} /></Link></div><div className="mc-signal-grid">{signals.slice(0, 3).map((f) => <a className="mc-signal" key={f.id} href={f.source_url} target="_blank" rel="noreferrer"><span className="mc-eyebrow">{featureOf(f.feature_id)?.name ?? "Research finding"}</span><h3>{f.claim}</h3><span>{hostname(f.source_url)} <ArrowUpRight size={14} /></span></a>)}{!signals.length && trends.slice(0, 3).map((f) => <Link className="mc-signal" key={f.id} href={`/evidence/public/${encodeURIComponent(f.id)}`}><span className="mc-eyebrow">INDUSTRY CONTEXT</span><h3>{f.title}</h3><span>{f.source_name} <ArrowUpRight size={14} /></span></Link>)}</div><p className="mc-caption">Vehicle-wide research and industry context may concern other markets. External findings do not change the internal counts.</p></section>

      <footer className="mc-footer"><span><Layers3 size={14} /> BMW snapshot + traceable public sources</span><div><Link className="mc-text-link" data-testid="open-requirements" href={`/requirements?${scope}`}>{number(requirementsByMarket[market.id])} open requirements <ArrowUpRight size={14} /></Link>{[{ name: "Sources & limitations", icon: CircleHelp, content: sources, description: "Inspect the original sources and the limits of the available data." }, { name: "Recent activity", icon: MousePointer2, content: activity, description: `Saved work for the ${vehicle.name}, across all markets.` }, { name: "Planning horizon", icon: Gauge, content: timeline, description: "Illustrative development milestones, not confirmed BMW programme dates." }].map((item) => <Sheet key={item.name}><SheetTrigger asChild><button><item.icon size={14} />{item.name}</button></SheetTrigger><SheetContent className="mc-detail-sheet"><SheetHeader><SheetTitle>{item.name}</SheetTitle><SheetDescription>{item.description}</SheetDescription></SheetHeader><div className="mc-drawer-content">{item.content}</div></SheetContent></Sheet>)}</div></footer>

      <Sheet open={!!topic} onOpenChange={(open) => { if (!open) setTopic(null) }}><SheetContent className="mc-detail-sheet" data-testid="topic-evidence"><SheetHeader><p className="mc-eyebrow">BMW CUSTOMER EVIDENCE <span> / </span> {market.name.toUpperCase()}</p><SheetTitle>{topic?.label}</SheetTitle><SheetDescription>{topic ? `${number(topic.comments)} ${activeMode.verb} comments in the full snapshot. Original taxonomy: ${topic.level2}.` : ""}</SheetDescription></SheetHeader>{topic && <div className="mc-drawer-content"><p className="mc-drawer-label">In their own words</p>{(quotes[topic.level2] ?? []).filter((q) => q.sentiment === mode).slice(0, 3).map((q) => <article className="mc-evidence-quote" key={q.comment_id}><blockquote>“{q.text}”</blockquote><p>{countryName(q.country)} · Source {q.source} · Excel row {q.excel_row}</p><Link href={`/evidence/comment/${encodeURIComponent(q.comment_id)}`}>Open original record <ArrowUpRight size={14} /></Link></article>)}{!themeQuote(topic) && <p>No matching quote in the displayed sample. The aggregate above comes from the complete internal data.</p>}<p className="mc-caption">Illustrative excerpts from up to 24 label rows, in stable record order. Not all feedback is shown. Counts are unique within a theme and sentiment, not across themes.</p>{matchedSignals.length > 0 && <><p className="mc-drawer-label">Outside signals for this feature</p>{matchedSignals.slice(0, 3).map((f) => <a className="mc-evidence-quote mc-evidence-link" href={f.source_url} key={f.id} target="_blank" rel="noreferrer"><p>{f.claim}</p><span>{f.source_name} <ArrowUpRight size={14} /></span></a>)}<p className="mc-caption">Matched by the existing feature map, which is not yet team-reviewed. These may concern other markets.</p></>}<div className="mc-drawer-actions"><Link className="mc-primary" href={`/what-if?${scope}&q=${encodeURIComponent(`Improve ${topic.label.toLowerCase()} on the next BMW ${vehicle.name}`)}`}>Explore a change <ArrowRight size={16} /></Link><Link className="mc-text-link" href={`/research?${scope}`}>Investigate outside BMW <ArrowUpRight size={15} /></Link></div></div>}</SheetContent></Sheet>
    </main>
  )
}
