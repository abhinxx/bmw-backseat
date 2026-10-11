// Deck narrative copy: one validated LLM call over the grounded payload (spec Prompt A),
// deterministic fallback if the call or the validator rejects anything.
import { llm } from "@/lib/simulate"
import { type DeckPayload } from "@/lib/deck/payload"

export type DeckCopy = {
  title_line: string
  exec_bullets: string[]
  takeaway: string
  image_prompt: string
}
export type CopyResult = { copy: DeckCopy; source: "model" | "fallback" }

// Spec Prompt A, verbatim.
const SYSTEM = `You are the copy writer for BMW Backseat, an evidence-led product-intelligence console.
You receive a JSON payload describing one stored What-If simulation run: the proposal
question, the vehicle, nine persona verdicts with confidence, evidence totals, cited
evidence items (verbatim comments / study cells, each with an ID), and market volumes.

Write the narrative copy for a 5-page corporate decision memo. Rules, in priority order:
1. USE ONLY FACTS IN THE PAYLOAD. Every number you output must appear verbatim in the
   payload. Every evidence ID you output (G60-xxxx or STUDY-n) must exist in
   payload.cited[]. A validator rejects the whole response otherwise — then deterministic
   fallback copy ships instead, so strictness pays.
2. Audience: BMW product managers forwarding this internally. Corporate, direct, short.
   No marketing adjectives ("game-changing", "revolutionary", "seamless"). No em-dash
   padding, no exclamation marks.
3. Honesty rules inherited from the product: verdicts are simulated persona interpretations,
   never "customer votes"; anything forward-looking belongs to assumptions, not evidence;
   when a verdict is 'not_enough_evidence', say so plainly.
4. Tone per segment voice exists ONLY in verdict.reaction — do not rewrite those quotes.
5. Output exactly this JSON: {
  "title_line": "≤60 chars, the proposal as a decision, not a question",
  "exec_bullets": [ "≤140 chars, 3 bullets: net verdict + strongest evidence; the
                    main opposing signal; the honest caveat (tier/confidence/coverage)" ],
  "takeaway": "≤180 chars, one sentence a PM would repeat in a meeting",
  "image_prompt": "60-120 words, the COMPLETE prompt for the cover illustration —
                    you are the art director: subject and metaphor specific to THIS
                    proposal (see art-director rules below); composition encodes the
                    verdict split through objects, never through data"
}
6. If payload totals show llm_called=false for a persona, never describe its verdict as
   evidence-based.`

// Art-director direction (spec Prompt B) folded in, since the copy model authors the image prompt too.
const ART_DIRECTION = `\n\nART-DIRECTOR RULES for image_prompt: subject and metaphor must be specific to THIS proposal's change (what physically or experientially changes for the customer), not generic automotive stock. Encode the verdict composition through objects/composition (count, color, placement), never through data graphics. Scene style: premium editorial isometric/flat illustration, calm, corporate. Do not repeat the hard technical constraints (palette, no-text, aspect) in the prompt; the server appends them.`

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title_line", "exec_bullets", "takeaway", "image_prompt"],
  properties: {
    title_line: { type: "string" },
    exec_bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
    takeaway: { type: "string" },
    image_prompt: { type: "string" },
  },
}

// A citation ID in prose must be an ID that exists in payload.cited.
const CITED_ID = /G60-\d{4}|STUDY-\d+|OPT-[A-Z0-9]+-\d+/g

// Every digit sequence in the prose must appear verbatim in the payload; every cited-ID-shaped
// token must be a real cited id. (image_prompt is exempt: the PDF prints no text from the image
// and the compliance footer bans numbers, so hallucinated figures cannot reach the deck through it.)
export function validateCopy(copy: DeckCopy, payload: DeckPayload): string[] {
  const problems: string[] = []
  const json = JSON.stringify(payload)
  const ids = new Set(payload.cited.map((c) => c.id))
  const fields = [copy.title_line, ...copy.exec_bullets, copy.takeaway]
  if (copy.title_line.length > 60) problems.push(`title_line too long: ${copy.title_line.length}`)
  if (copy.takeaway.length > 180) problems.push(`takeaway too long: ${copy.takeaway.length}`)
  for (const text of fields) {
    for (const m of text.match(/\d[\d.,]*/g) ?? []) {
      const bare = m.replace(/[.,]+$/, "")
      if (!json.includes(bare) && !json.includes(m)) problems.push(`number not in payload: ${m}`)
    }
    for (const id of text.match(CITED_ID) ?? []) {
      if (!ids.has(id)) problems.push(`unknown citation id: ${id}`)
    }
  }
  return problems
}

const VERDICT_TEXT: Record<string, string> = {
  more_likely: "more likely to buy",
  slightly_more_likely: "slightly more likely",
  no_effect: "no effect",
  slightly_less_likely: "slightly less likely",
  less_likely: "less likely to buy",
  not_enough_evidence: "not enough evidence",
}

export function fallbackCopy(payload: DeckPayload): DeckCopy {
  const { counts, cited, personas } = payload
  const most = cited.filter((c) => c.for.length > 0)
  const opposed = cited.filter((c) => c.against.length > 0)
  const lowTier = personas.filter((p) => /^B|^C/.test(p.tier)).map((p) => p.label)
  const top = most[0]
  const topAgainst = opposed[0]
  const title = payload.run.change_summary.replace(/[?.]+$/, "").slice(0, 60)
  const feature = payload.run.feature_id ? payload.run.feature_id.replaceAll("_", " ") : "this change"
  const b3full = `${counts.noEvidence} of 9 have not enough evidence${lowTier.length ? ` (inferred tiers: ${lowTier.slice(0, 2).join(", ")})` : ""}. Simulated interpretations, not a customer vote.`
  const b3short = `${counts.noEvidence} of 9 have not enough evidence. Simulated interpretations, not a customer vote.`
  const bullets = [
    `${counts.more} of 9 simulated segments read ${feature} as more likely to buy${top ? `; the top cited item is ${top.id}` : ""}.`.slice(0, 140),
    `${counts.less} segments read it as less likely${topAgainst ? `; ${topAgainst.against.length} cite ${topAgainst.id} against it` : ""}. ${counts.none} see no effect.`.slice(0, 140),
    b3full.length <= 140 ? b3full : b3short,
  ]
  const takeaway =
    `Simulated read: ${counts.more} more likely, ${counts.none} no effect, ${counts.less} less likely, ${counts.noEvidence} without evidence, across 9 BMW ${payload.run.vehicle} segments (evidence ${payload.run.evidence_hash}).`.slice(0, 180)
  return {
    title_line: title,
    exec_bullets: bullets,
    takeaway,
    image_prompt:
      `Premium editorial isometric illustration of the customer experience implied by the proposed BMW ${payload.run.vehicle} change "${payload.run.change_summary}" (${payload.run.feature_id ? payload.run.feature_id.replaceAll("_", " ") : "product change"}): ` +
      `a calm scene of the affected control surface or cabin zone, with objects placed to encode the segment reaction — ${counts.more} prominent confident objects in signal green tones, ${counts.none} neutral objects in cool gray, ${counts.less} smaller resistant objects in amber, ${counts.noEvidence} faint half-formed shapes. No data graphics, no charts: the split lives only in object count, colour and placement.`,
  }
}

export async function copyForDeck(payload: DeckPayload): Promise<CopyResult> {
  try {
    const user = JSON.stringify(payload)
    let copy = await llm<DeckCopy>(SYSTEM + ART_DIRECTION, user, "deck_copy", SCHEMA, "medium")
    let problems = validateCopy(copy, payload)
    // One correction round: small slips (a takeaway 6 characters too long) should not cost the whole copy.
    if (problems.length) {
      console.error("deck copy rejected, retrying once:", problems)
      const retry = `${user}\n\nYour previous answer was rejected by the validator for: ${problems.join("; ")}. Fix exactly these problems and answer again; keep everything else.`
      copy = await llm<DeckCopy>(SYSTEM + ART_DIRECTION, retry, "deck_copy", SCHEMA, "medium")
      problems = validateCopy(copy, payload)
    }
    if (problems.length) {
      console.error("deck copy rejected by validator:", problems)
      return { copy: fallbackCopy(payload), source: "fallback" }
    }
    return { copy, source: "model" }
  } catch (e) {
    console.error("deck copy call failed, using fallback:", e)
    return { copy: fallbackCopy(payload), source: "fallback" }
  }
}
