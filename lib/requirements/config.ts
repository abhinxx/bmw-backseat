// Requirements method, in one place: what feeds the score, how much each factor weighs, how evidence is graded,
// and the limits. Shown read-only on Settings and Workflow so the method is visible, not hidden in code.
import type { EvidenceGrade, FactorId, Priority, ReqKind } from "@/lib/requirements/types"

export const SCORE_VERSION = "score-v1"
export const DRAFT_PROMPT_VERSION = "req-draft-v1"
export const DRAFT_MODEL = "gpt-6-luna"

/** Source hierarchy (brief §9): higher tiers win when sources disagree. */
export const SOURCE_HIERARCHY = [
  { tier: 1, name: "BMW internal data", detail: "Customer comments, customer study, price lists, sales volumes", tables: "feedback_comment, feedback_label, study_metric, option_item, sales_volume" },
  { tier: 2, name: "Verified public data", detail: "BMW Group Report 2025, industry studies, rival tables, owner quotes; every quote checked against its source", tables: "external_finding" },
  { tier: 3, name: "Research Agent findings", detail: "Live web searches; a quote is kept only if found word for word on the page", tables: "research_finding" },
  { tier: 4, name: "What-If simulations", detail: "Model-based reactions of the 9 customer segments; 5 Series only. Simulated, not a customer vote", tables: "simulation_verdict" },
  { tier: 5, name: "CSV uploaded by the PM", detail: "Sent to the AI as context only; never counted in the score; labelled unverified", tables: "requirement_run.csv_rows" },
] as const

export const FACTORS: Record<FactorId, { label: string; definition: string; source: string; defaultWeight: number }> = {
  customer_voice: {
    label: "Customer voice",
    definition:
      "Share of this car's unique customer comments that complain about or ask for this feature (praise for 'protect'), relative to the most-discussed feature.",
    source: "feedback_comment, feedback_label",
    defaultWeight: 30,
  },
  satisfaction: {
    label: "Customer study",
    definition:
      "How this car scores on the matching study questions against the best BMW sibling in the same study and market. A gap raises 'fix' and 'add'; a lead raises 'protect'.",
    source: "study_metric",
    defaultWeight: 20,
  },
  market_reach: {
    label: "Market reach",
    definition: "2025 sales share of the markets where the signal appears (feedback or study).",
    source: "sales_volume, feedback_comment",
    defaultWeight: 15,
  },
  competitor: {
    label: "Rival offer",
    definition:
      "How many tracked rivals offer the feature (standard = 1, option = 0.5), for features the rival tables cover. Not applicable otherwise.",
    source: "external_finding (competitor tables)",
    defaultWeight: 15,
  },
  outside_voice: {
    label: "Outside voices agree",
    definition:
      "Independent outside channels (owner forums, Chinese and European owner reports, industry studies, Research Agent findings) pointing the same way as BMW's customers. Max at 4 channels.",
    source: "external_finding, research_finding",
    defaultWeight: 12,
  },
  simulated: {
    label: "Segment reaction (simulated)",
    definition:
      "Net share of the 9 customer segments more likely to buy in the latest What-If on this feature. Model-based, 5 Series only, lowest tier.",
    source: "simulation_run, simulation_verdict",
    defaultWeight: 8,
  },
}

export const DEFAULT_WEIGHTS = Object.fromEntries(
  Object.entries(FACTORS).map(([id, f]) => [id, f.defaultWeight])
) as Record<FactorId, number>

export const PRIORITY_RULE: { priority: Priority; min: number; label: string }[] = [
  { priority: "P1", min: 60, label: "Must have: argue for it at the next gate" },
  { priority: "P2", min: 40, label: "Should have: keep in the concept, revisit with more evidence" },
  { priority: "P3", min: 0, label: "Could have: park unless new evidence appears" },
]

export const priorityOf = (score: number): Priority =>
  (PRIORITY_RULE.find((p) => score >= p.min) ?? PRIORITY_RULE[PRIORITY_RULE.length - 1]).priority

export const EVIDENCE_LEVELS: Record<EvidenceGrade, string> = {
  A: "Strong: 30+ customer comments, a customer-study measure and at least one independent outside channel",
  B: "Good: 15+ customer comments plus a study measure or an outside channel",
  C: "Limited: 5+ customer comments, nothing else confirms it",
  D: "Thin: fewer than 5 comments; treat as a hypothesis",
}

export const KIND_LABEL: Record<ReqKind, { label: string; hint: string }> = {
  fix: { label: "Fix", hint: "A pain point customers report today" },
  add: { label: "Add", hint: "An unmet want or a gap against rivals" },
  protect: { label: "Protect", hint: "Something customers love and must not lose in the successor" },
}

/** When a feature becomes a candidate. Counts are unique comments for the car line. */
export const CANDIDATE_RULE = {
  minPainOrWant: 8, // fix/add: complaints + wishes
  addWhenWantsAtLeast: 0.5, // add (not fix) when wishes >= 50% of complaints
  minPraise: 40, // protect: praise
  praiseOverPain: 2, // protect only when praise > 2x (complaints + wishes)
}

export const LIMITS = {
  csvMaxRows: 300,
  csvMaxBytes: 500_000,
  csvRowsPerRequirement: 10,
  commentsPerRequirement: 12,
  reasonMinChars: 5,
}

export const STATUS_LABEL = {
  proposed: "Proposed",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  postponed: "Postponed",
} as const

/** Who does what (deliverable 3). Used by the Workflow page and Settings. */
export const WORKFLOW = [
  { step: "Situation analysis", who: "ai", does: "Reads BMW feedback, study, price lists and sales; adds verified public data and research findings when switched on." },
  { step: "Structure and context", who: "code", does: "Groups comments into 16 features by BMW's own taxonomy; counts each comment once; maps public findings to the same features." },
  { step: "Requirement candidates", who: "code", does: "A feature becomes a candidate when enough customers complain, ask or praise (fix / add / protect)." },
  { step: "Drafting", who: "ai", does: "Writes the requirement, measurable target, rationale, assumptions and uncertainties from the cited evidence only. Uncited ids are dropped and logged." },
  { step: "Scoring and priority", who: "code", does: "Computes each factor from the database and the weighted score. The AI never produces a number." },
  { step: "Review gate", who: "pm", does: "The PM approves, edits, rejects, postpones or overrides the priority, always with a reason. Mandatory before anything leaves the tool." },
  { step: "Documentation", who: "code", does: "Every change is logged with who, when, before and after, and why. Export to CSV or Codebeamer." },
] as const
