// Shared types for the Requirements feature. Contract between the engine (lib/requirements/engine.ts),
// the API routes (app/api/requirements/*), the UI (app/requirements/*, components/requirements/*),
// Settings, Workflow and the exports. Change only with the owner of the engine.

export const REQ_STATUSES = ["proposed", "in_review", "approved", "rejected", "postponed"] as const
export type ReqStatus = (typeof REQ_STATUSES)[number]

/** fix = a pain point to remove · add = an unmet want or a gap · protect = what customers love and must not lose */
export type ReqKind = "fix" | "add" | "protect"

export type Priority = "P1" | "P2" | "P3"

/** A = strong ... D = thin. Definitions in config.ts (EVIDENCE_LEVELS). Separate from priority. */
export type EvidenceGrade = "A" | "B" | "C" | "D"

export type FactorId = "customer_voice" | "satisfaction" | "market_reach" | "competitor" | "outside_voice" | "simulated"

/** One priority factor, computed by code from the database. value is 0..1, or null when not applicable. */
export type Factor = {
  id: FactorId
  label: string
  value: number | null
  weight: number // weight used for this score (0 when excluded)
  included: boolean // false when the PM switched the source off or it does not apply
  detail: string // the actual numbers behind the value, in plain words
  source: string // database tables the value was computed from
}

/** Where a piece of evidence lives. href is an in-app link (/evidence/...) or an external URL. */
export type SourceKind = "comment" | "study" | "option" | "rival" | "public" | "research" | "whatif" | "csv"

export type SourceRef = {
  id: string // citation id the model saw, e.g. G60-0435, STUDY-3, RIVAL-2, PUB-4, RES-1, SIM-1, CSV-14
  kind: SourceKind
  label: string // short human label: "Customer comment, US, Excel row 412"
  text: string | null // quote or value
  href: string | null
  role: "supports" | "opposes" | "context"
}

export type Requirement = {
  id: string // uuid
  code: string // human id, unique and stable: REQ-G60-CTRL-FIX
  vehicle: string // G60 | G70 | F70
  feature_id: string // lib/features.ts id
  kind: ReqKind
  title: string
  description: string
  target: string | null // measurable target, always a forward-looking assumption
  rationale: string | null
  assumptions: string[]
  uncertainties: string[]
  conflicts: string[]
  markets: string[] // EU / US / CN / RoW where the signal exists
  score: number // 0..100, code only
  priority: Priority
  priority_override: Priority | null // set by the PM, logged
  rank: number // 1 = highest score within the vehicle
  evidence_level: EvidenceGrade
  factors: Factor[]
  sources: SourceRef[]
  status: ReqStatus
  status_reason: string | null
  edited_by_pm: boolean
  run_id: string | null
  version: number
  created_at: string
  updated_at: string
}

/** Append-only audit log. Every change to content, score, priority, evidence or status is one row. */
export type ReqEvent = {
  id: number
  requirement_id: string
  run_id: string | null
  at: string
  actor_type: "ai" | "code" | "pm" | "system"
  actor: string // "gpt-6-luna · req-draft-v1", "score-v1", "Anna (not signed in)"
  action: string // created · rescored · edited · status · challenged · evidence_added · exported · priority_override
  field: string | null
  before: unknown
  after: unknown
  reason: string | null
}

/** One generation run ("Create requirements"). */
export type ReqRun = {
  id: string
  created_at: string
  vehicle: string
  options: GenerateOptions
  weights: Record<FactorId, number>
  score_version: string
  prompt_version: string
  model: string
  csv_name: string | null
  csv_count: number
  actor: string | null
  status: "running" | "done" | "failed"
  duration_ms: number | null
  summary: { created: number; updated: number; unchanged: number; dropped_citations: number } | null
}

export type GenerateOptions = {
  public: boolean // verified public data: report facts, owner quotes, trend studies, rival tables
  research: boolean // Research Agent findings
  whatif: boolean // What-If simulations (5 Series only)
}

/** A row from a CSV the PM uploaded. Sent as context, never mapped into BMW tables. Labelled unverified. */
export type UploadedRow = {
  id: string // CSV-1, CSV-2, ...
  text: string // the feedback / comment text
  extra: Record<string, string> // the other columns, as given
}

export type UploadedCsv = {
  name: string
  rows: UploadedRow[]
}
