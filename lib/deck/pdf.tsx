// The decision memo itself: @react-pdf/renderer, A4 landscape, Helvetica, spec palette.
// Every figure and quote on the page comes from DeckPayload — nothing is recomputed here.
import { Page, Text, View, Image, Document, renderToBuffer } from "@react-pdf/renderer"
import type { CitedItem, DeckPayload } from "@/lib/deck/payload"
import type { DeckCopy } from "@/lib/deck/copy"

export const COLORS = {
  charcoal: "#1d1d1f",
  gray: "#f4f5f7",
  green: "#166534",
  amber: "#b45309",
  blue: "#0653b6",
  midgray: "#6e6e73",
}

// ---------- typography-safe text ----------
// Base-14 Helvetica is Windows-1252. Map typographic Unicode to safe equivalents and strip anything
// the font cannot encode (CJK, stray symbols) so no glyph can crash or clip the render.
const CP1252_EXTRA = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("")
)
const SAFE_TEXT = /[\t\n\r\x20-\x7E\u00A0-\u00FF]/
const MAP: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", " ": " ", "×": "x", "→": "->", "←": "<-", "≈": "~", "≤": "<=", "≥": ">=",
}
export function safe(s: string): string {
  let out = ""
  for (const ch of s) {
    if (MAP[ch]) out += MAP[ch]
    else if (SAFE_TEXT.test(ch)) out += ch
    else if (CP1252_EXTRA.has(ch)) out += ch
    // everything else (CJK, emoji, math) is dropped: Helvetica cannot draw it
  }
  return out.replace(/\s+/g, " ").trim()
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)

// ---------- shared bits ----------
const VERDICT_LABEL: Record<string, string> = {
  more_likely: "More likely to buy",
  slightly_more_likely: "Slightly more likely",
  no_effect: "No effect",
  slightly_less_likely: "Slightly less likely",
  less_likely: "Less likely to buy",
  not_enough_evidence: "Not enough evidence",
}
const verdictColor = (v: string) =>
  v === "more_likely" || v === "slightly_more_likely" ? COLORS.green
  : v === "less_likely" || v === "slightly_less_likely" ? COLORS.amber
  : v === "no_effect" ? COLORS.blue
  : COLORS.midgray

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" })

const PAGE_STYLE = { fontFamily: "Helvetica", color: COLORS.charcoal, paddingTop: 36, paddingBottom: 46, paddingLeft: 40, paddingRight: 40 }

function Footer({ run }: { run: DeckPayload["run"] }) {
  return (
    <View
      style={{ position: "absolute", bottom: 18, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#c7c7cc", paddingTop: 5 }}
      fixed
    >
      <Text style={{ fontSize: 6.5, color: COLORS.midgray }}>
        {`run ${run.id} · ${run.model} · ${run.prompt_version} · generated ${dateFmt(new Date().toISOString())}`}
      </Text>
      <Text style={{ fontSize: 6.5, color: COLORS.midgray }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontSize: 15, fontWeight: 700, color: COLORS.charcoal, marginBottom: 2 }}>{safe(children)}</Text>
}

// Verdict summary: one segmented strip where each count label sits inside its own coloured cell,
// cell width proportional to the count — the legend can never drift from the bar.
function VerdictBar({ counts }: { counts: DeckPayload["counts"] }) {
  const total = Math.max(counts.more + counts.none + counts.less + counts.noEvidence, 1)
  const Cell = ({ n, t, color, bg }: { n: number; t: string; color: string; bg: string }) => (
    <View style={{ flexGrow: Math.max(n, 0.55), backgroundColor: bg, paddingTop: 7, paddingBottom: 7, paddingLeft: 9, borderTopWidth: 3, borderTopColor: color, marginRight: 3 }}>
      <Text style={{ fontSize: 15, fontWeight: 700, color }}>{n}</Text>
      <Text style={{ fontSize: 7.5, color: COLORS.midgray }}>{safe(t)}</Text>
    </View>
  )
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <Cell n={counts.more} t="more likely" color={COLORS.green} bg="#eaf3ec" />
        <Cell n={counts.none} t="no effect" color={COLORS.blue} bg="#e9f0f9" />
        <Cell n={counts.less} t="less likely" color={COLORS.amber} bg="#f7efe4" />
        <Cell n={counts.noEvidence} t="not enough evidence" color={COLORS.midgray} bg={COLORS.gray} />
      </View>
      <Text style={{ fontSize: 7, color: COLORS.midgray, marginTop: 4 }}>{`simulated segments: ${total}`}</Text>
    </View>
  )
}

// ---------- pages ----------
function CoverPage({ payload, copy, cover }: { payload: DeckPayload; copy: DeckCopy; cover: Buffer | null }) {
  const { run, counts } = payload
  return (
    <Page size="A4" orientation="landscape" style={PAGE_STYLE}>
      {cover ? (
        <Image src={`data:image/png;base64,${cover.toString("base64")}`} style={{ width: "100%", height: 216 }} />
      ) : (
        <View style={{ width: "100%", height: 60, backgroundColor: COLORS.gray }} />
      )}
      <Text style={{ fontSize: 8.5, letterSpacing: 1, color: COLORS.midgray, marginTop: 14, textTransform: "uppercase" }}>
        BMW Backseat · decision memo · simulated
      </Text>
      <Text style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{safe(copy.title_line)}</Text>
      <Text style={{ fontSize: 11, color: COLORS.midgray, marginTop: 5, maxWidth: 620 }}>{safe(`Question asked: ${run.question}`)}</Text>
      <Text style={{ fontSize: 9, color: COLORS.midgray, marginTop: 3 }}>
        {safe(`Vehicle ${run.vehicle} · run recorded ${dateFmt(run.created_at)} · evidence ${run.evidence_hash}`)}
      </Text>
      <View style={{ flexDirection: "row", marginTop: 16, gap: 28 }}>
        <View style={{ width: 430 }}>
          <VerdictBar counts={counts} />
        </View>
        <View style={{ width: 304 }}>
          {copy.exec_bullets.map((b, i) => (
            <Text key={i} style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 5 }}>
              {safe(`•  ${b}`)}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ marginTop: 14, backgroundColor: COLORS.gray, padding: 10, borderRadius: 4 }}>
        <Text style={{ fontSize: 10.5, lineHeight: 1.4 }}>{safe(copy.takeaway)}</Text>
      </View>
      <Text style={{ fontSize: 8.5, color: COLORS.midgray, marginTop: 10 }}>
        Simulated: a model-based interpretation of BMW evidence, not a customer vote.
      </Text>
      <Footer run={run} />
    </Page>
  )
}

export function SegmentBoardPage({ payload }: { payload: DeckPayload }) {
  return (
    <Page size="A4" orientation="landscape" style={PAGE_STYLE}>
      <SectionTitle>Segment board — how the nine segments reacted</SectionTitle>
      <Text style={{ fontSize: 8, color: COLORS.midgray, marginBottom: 8 }}>
        Simulated interpretations of the same evidence, per segment. Quotes are the segment voices stored with the run.
      </Text>
      <View style={{ flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: COLORS.charcoal, paddingBottom: 3, marginBottom: 2 }}>
        {([["Segment", 150], ["Region / market", 130], ["Tier", 44], ["Verdict", 128], ["Conf.", 52], ["Reaction", 258]] as const).map(([h, w]) => (
          <Text key={h} style={{ width: w, fontSize: 7, fontWeight: 700, color: COLORS.midgray, textTransform: "uppercase" }}>{h}</Text>
        ))}
      </View>
      {payload.personas.map((p) => (
        <View key={p.id} style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e3e3e6", paddingVertical: 4 }}>
          <Text style={{ width: 150, fontSize: 8.5, fontWeight: 700 }}>
            {safe(p.label)}
            <Text style={{ fontWeight: 400, color: COLORS.midgray }}>{`  ${safe(p.id)} · ${safe(p.name)}`}</Text>
          </Text>
          <Text style={{ width: 130, fontSize: 8, color: COLORS.midgray, paddingTop: 1 }}>{safe(`${p.region} / ${p.market}`)}</Text>
          <Text style={{ width: 44, fontSize: 8, paddingTop: 1 }}>{safe(p.tier)}</Text>
          <Text style={{ width: 128, fontSize: 8, color: verdictColor(p.verdict), fontWeight: 700, paddingTop: 1 }}>
            {safe(VERDICT_LABEL[p.verdict] ?? p.verdict)}
            {p.llm_called ? "" : " (no model call)"}
          </Text>
          <Text style={{ width: 52, fontSize: 8, color: COLORS.midgray, paddingTop: 1 }}>{safe(p.confidence)}</Text>
          <Text style={{ width: 258, fontSize: 8, lineHeight: 1.3 }}>{p.reaction ? safe(`“${truncate(p.reaction, 260)}”`) : "—"}</Text>
        </View>
      ))}
      <Footer run={payload.run} />
    </Page>
  )
}

function EvidenceItemBlock({ it, showText }: { it: CitedItem; showText?: boolean }) {
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e3e3e6", paddingVertical: 4 }}>
      <Text style={{ width: 92, fontSize: 8, fontWeight: 700 }}>
        {it.id}
        <Text style={{ fontWeight: 400, color: COLORS.midgray }}>{`\n${it.kind}`}</Text>
      </Text>
      {showText && (
        <View style={{ width: 512, paddingRight: 10 }}>
          <Text style={{ fontSize: 8, lineHeight: 1.35 }}>{safe(truncate(it.text, 400))}</Text>
          <Text style={{ fontSize: 6.5, color: COLORS.midgray, marginTop: 2 }}>{safe(it.source)}</Text>
        </View>
      )}
      <View style={{ width: showText ? 148 : "auto", flex: showText ? undefined : 1 }}>
        <Text style={{ fontSize: 8, color: COLORS.green, fontWeight: 700 }}>{`cited for: ${it.for.length}`}</Text>
        <Text style={{ fontSize: 8, color: COLORS.amber, fontWeight: 700 }}>{`cited against: ${it.against.length}`}</Text>
      </View>
    </View>
  )
}

export function EvidencePage({ payload }: { payload: DeckPayload }) {
  const items = payload.cited.slice(0, 12)
  return (
    <Page size="A4" orientation="landscape" style={PAGE_STYLE}>
      <SectionTitle>What the evidence says</SectionTitle>
      <Text style={{ fontSize: 8, color: COLORS.midgray, marginBottom: 8 }}>
        {`The ${items.length} most-cited items of ${payload.cited.length} cited in total. Verbatim customer comments, study cells and price-list entries, each with its ID.`}
      </Text>
      {items.map((it) => (
        <EvidenceItemBlock key={it.id} it={it} showText />
      ))}
      <Footer run={payload.run} />
    </Page>
  )
}

export function AssumptionsPage({ payload }: { payload: DeckPayload }) {
  const withAssumptions = payload.personas.filter((p) => p.assumptions.length)
  const thin = payload.personas.filter((p) => p.verdict === "not_enough_evidence")
  return (
    <Page size="A4" orientation="landscape" style={PAGE_STYLE}>
      <SectionTitle>Assumptions and what we don&apos;t know</SectionTitle>
      <Text style={{ fontSize: 8, color: COLORS.midgray, marginBottom: 8 }}>
        Forward-looking assumptions the verdicts depend on — these are not evidence. Segments without enough evidence are named plainly.
      </Text>
      {withAssumptions.map((p) => (
        <View key={p.id} style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 8.5, fontWeight: 700 }}>
            {safe(p.label)}
            <Text style={{ fontWeight: 400, color: COLORS.midgray }}>{`  (${p.id})`}</Text>
          </Text>
          {p.assumptions.map((a, i) => (
            <Text key={i} style={{ fontSize: 8, lineHeight: 1.35, marginLeft: 10 }}>{safe(`•  ${truncate(a, 400)}`)}</Text>
          ))}
        </View>
      ))}
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{`No verdict, not enough evidence (${thin.length})`}</Text>
        {thin.length === 0 && <Text style={{ fontSize: 8, color: COLORS.midgray }}>Every segment could reach a verdict on this change.</Text>}
        {thin.map((p) => (
          <Text key={p.id} style={{ fontSize: 8, lineHeight: 1.35, marginBottom: 3 }}>
            {safe(`${p.label} (${p.id}): ${p.reason ?? "no reason recorded"}`)}
          </Text>
        ))}
      </View>
      <Footer run={payload.run} />
    </Page>
  )
}

// Appendix: chunked deterministically by character budget so a page can never overflow.
export function appendixChunks(items: CitedItem[]) {
  const chunks: CitedItem[][] = []
  let current: CitedItem[] = []
  let budget = 5200
  for (const it of items) {
    const cost = it.text.length + it.source.length + it.for.length * 30 + it.against.length * 30 + 80
    if (budget - cost < 0 && current.length) {
      chunks.push(current)
      current = []
      budget = 5200
    }
    current.push(it)
    budget -= cost
  }
  if (current.length) chunks.push(current)
  return chunks
}

export function AppendixPage({ payload, items, part, parts }: { payload: DeckPayload; items: CitedItem[]; part: number; parts: number }) {
  return (
    <Page size="A4" orientation="landscape" style={PAGE_STYLE}>
      <SectionTitle>{`Appendix — citation map${parts > 1 ? ` (${part}/${parts})` : ""}`}</SectionTitle>
      <Text style={{ fontSize: 8, color: COLORS.midgray, marginBottom: 6 }}>
        Every evidence ID cited in this run: verbatim text and which simulated segments cite it for or against.
      </Text>
      {items.map((it) => (
        <View key={it.id} style={{ borderBottomWidth: 0.5, borderBottomColor: "#e3e3e6", paddingVertical: 3 }}>
          <Text style={{ fontSize: 8 }}>
            <Text style={{ fontWeight: 700 }}>{it.id}</Text>
            <Text style={{ color: COLORS.green }}>{` for: ${it.for.map((l) => truncate(l, 28)).join(", ") || "none"}`}</Text>
            <Text style={{ color: COLORS.amber }}>{`  ·  against: ${it.against.map((l) => truncate(l, 28)).join(", ") || "none"}`}</Text>
          </Text>
          <Text style={{ fontSize: 7.5, lineHeight: 1.3, color: "#3a3a3c" }}>{safe(truncate(it.text, 400))}</Text>
          <Text style={{ fontSize: 6.5, color: COLORS.midgray }}>{safe(it.source)}</Text>
        </View>
      ))}
      <Footer run={payload.run} />
    </Page>
  )
}

export function DeckDocument({ payload, copy, cover }: { payload: DeckPayload; copy: DeckCopy; cover: Buffer | null }) {
  const chunks = appendixChunks(payload.cited)
  return (
    <Document>
      <CoverPage payload={payload} copy={copy} cover={cover} />
      <SegmentBoardPage payload={payload} />
      <EvidencePage payload={payload} />
      <AssumptionsPage payload={payload} />
      {chunks.map((c, i) => (
        <AppendixPage key={i} payload={payload} items={c} part={i + 1} parts={chunks.length} />
      ))}
    </Document>
  )
}

export async function renderDeckPdf(args: { payload: DeckPayload; copy: DeckCopy; cover: Buffer | null }): Promise<Buffer> {
  return renderToBuffer(<DeckDocument {...args} />)
}
