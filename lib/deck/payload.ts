// The grounded payload for the deck export (docs/DECK-EXPORT-SPEC.md).
// Deterministic: built only from the stored run + persona files. AI never touches these numbers;
// the PDF and the copy model both read ONLY this object.
import { PERSONAS, type Persona } from "@/lib/personas"
import { type Run, type VerdictRow, loadRun } from "@/lib/simulate"

export type Counts = { more: number; none: number; less: number; noEvidence: number }

export type CitedItem = {
  id: string
  kind: "comment" | "study" | "option"
  text: string
  source: string
  for: string[] // persona labels citing it in support
  against: string[] // persona labels citing it against
}

export type PersonaRow = {
  id: string
  name: string
  label: string
  region: string
  market: string
  tier: string
  verdict: string
  confidence: string
  reaction: string | null
  reason: string | null
  assumptions: string[]
  llm_called: boolean
}

export type DeckPayload = {
  run: {
    id: string
    question: string
    change_summary: string
    feature_id: string | null
    vehicle: string
    model: string
    prompt_version: string
    created_at: string
    evidence_hash: string
  }
  counts: Counts
  personas: PersonaRow[]
  cited: CitedItem[] // sorted: most cited first
}

const personaOf: Record<string, Persona> = Object.fromEntries(PERSONAS.map((p) => [p.id, p]))

// Source lines built exactly like items() in components/what-if-client.tsx.
function collectEvidenceItems(v: VerdictRow): CitedItem[] {
  const ev = v.evidence
  const label = personaOf[v.persona_id]?.label ?? v.persona_id
  const out: CitedItem[] = []
  for (const c of ev.comments) {
    out.push({
      id: c.id,
      kind: "comment",
      text: c.text,
      source: `Feedback workbook, Excel row ${c.excel_row}${c.taxonomy ? ` · class "${c.taxonomy}"` : ""} · ${c.country}, ${c.engine}, ${c.sentiment}`,
      for: v.supporting_ids.includes(c.id) ? [label] : [],
      against: v.opposing_ids.includes(c.id) ? [label] : [],
    })
  }
  for (const s of ev.study) {
    out.push({
      id: s.id,
      kind: "study",
      text: `${s.model} · ${s.attribute}: ${s.metric === "top2box" ? `${(s.value * 100).toFixed(1)}% top-2-box` : `${s.value.toFixed(2)} mean`}`,
      source: `Customer study, ${s.source}`,
      for: v.supporting_ids.includes(s.id) ? [label] : [],
      against: v.opposing_ids.includes(s.id) ? [label] : [],
    })
  }
  for (const o of ev.options) {
    out.push({
      id: o.id,
      kind: "option",
      text: `${o.code} ${o.name}${o.price_eur != null ? ` · EUR ${o.price_eur}` : ""}. Contents: ${o.contents}`,
      source: `Price list Germany July 2026, page ${o.page}`,
      for: v.supporting_ids.includes(o.id) ? [label] : [],
      against: v.opposing_ids.includes(o.id) ? [label] : [],
    })
  }
  return out
}

export function countVerdicts(verdicts: { verdict: string }[]): Counts {
  const c: Counts = { more: 0, none: 0, less: 0, noEvidence: 0 }
  for (const v of verdicts) {
    if (v.verdict === "more_likely" || v.verdict === "slightly_more_likely") c.more++
    else if (v.verdict === "no_effect") c.none++
    else if (v.verdict === "slightly_less_likely" || v.verdict === "less_likely") c.less++
    else if (v.verdict === "not_enough_evidence") c.noEvidence++
  }
  return c
}

export function buildPayload(run: Run): DeckPayload {
  const counts = countVerdicts(run.verdicts)
  const byId = new Map<string, CitedItem>()
  for (const v of run.verdicts) {
    for (const it of collectEvidenceItems(v)) {
      const prev = byId.get(it.id)
      if (prev) {
        prev.for.push(...it.for)
        prev.against.push(...it.against)
      } else {
        byId.set(it.id, it)
      }
    }
  }
  // Only items actually cited by at least one segment go into the citation map.
  const cited = [...byId.values()]
    .filter((i) => i.for.length + i.against.length > 0)
    .sort((a, b) => b.for.length + b.against.length - (a.for.length + a.against.length) || a.id.localeCompare(b.id))

  // Same order as the What-If UI (the persona files' order), not the DB's.
  const order = PERSONAS.map((p) => p.id)
  const personas: PersonaRow[] = run.verdicts
    .slice()
    .sort((a, b) => order.indexOf(a.persona_id) - order.indexOf(b.persona_id))
    .map((v) => {
      const p = personaOf[v.persona_id]
      return {
        id: v.persona_id,
        name: p?.name ?? v.persona_id,
        label: p?.label ?? v.persona_id,
        region: p?.region ?? "",
        market: p?.market ?? "",
        tier: p?.tier ?? "?",
        verdict: v.verdict,
        confidence: v.confidence,
        reaction: v.reaction,
        reason: v.reason,
        assumptions: v.assumptions,
        llm_called: v.llm_called,
      }
    })

  return {
    run: {
      id: run.id,
      question: run.question,
      change_summary: run.change.summary,
      feature_id: run.feature_id,
      vehicle: run.vehicle,
      model: run.model,
      prompt_version: run.prompt_version,
      created_at: run.created_at,
      evidence_hash: run.evidence_hash,
    },
    counts,
    personas,
    cited,
  }
}

export async function payloadForRun(id: string): Promise<DeckPayload | null> {
  const run = await loadRun(id)
  return run ? buildPayload(run) : null
}
