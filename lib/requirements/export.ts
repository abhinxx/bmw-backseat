// Pure export helpers: CSV (RFC 4180), JSON and the PTC Codebeamer v3 tracker-item payload.
// No React, no I/O here: the UI (components/requirements/*) calls these and handles the download/dialog.
import { KIND_LABEL, STATUS_LABEL } from "@/lib/requirements/config"
import type { Priority, Requirement } from "@/lib/requirements/types"

/** The priority that counts: a PM override wins over the score-derived one. */
export function effectivePriority(r: Requirement): Priority {
  return r.priority_override ?? r.priority
}

/** RFC 4180: fields containing comma, quote, CR or LF are wrapped in quotes; inner quotes are doubled. */
function csvField(value: string): string {
  // Untrusted PM/AI text must not execute as a spreadsheet formula.
  if (/^\s*[=+\-@]|^[\t\r\n]/.test(value)) value = "\'" + value
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function factorsColumn(r: Requirement): string {
  return r.factors
    .filter((f) => f.value !== null)
    .map((f) => `${f.label} ${f.value!.toFixed(2)} x${f.weight}`)
    .join("; ")
}

/**
 * CSV export, one row per requirement. UTF-8 BOM first so Excel opens umlauts correctly.
 * CRLF line ends per RFC 4180.
 */
export function toCsv(reqs: Requirement[]): string {
  const header = [
    "code",
    "uuid",
    "title",
    "description",
    "type",
    "vehicle",
    "priority",
    "priority_by",
    "score",
    "rank",
    "evidence_level",
    "status",
    "decision_reason",
    "markets",
    "target",
    "rationale",
    "assumptions",
    "uncertainties",
    "conflicts",
    "sources",
    "factors",
    "updated_at",
  ]
  const rows = reqs.map((r) => [
    r.code,
    r.id,
    r.title,
    r.description,
    KIND_LABEL[r.kind]?.label ?? r.kind,
    r.vehicle,
    effectivePriority(r),
    r.priority_override ? "PM override" : "Score",
    String(r.score),
    String(r.rank),
    r.evidence_level,
    STATUS_LABEL[r.status] ?? r.status,
    r.status_reason ?? "",
    r.markets.join(" / "),
    r.target ?? "",
    r.rationale ?? "",
    r.assumptions.join(" | "),
    r.uncertainties.join(" | "),
    r.conflicts.join(" | "),
    r.sources.map((s) => s.id).join(" "),
    factorsColumn(r),
    r.updated_at,
  ])
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","))
  return "\uFEFF" + lines.join("\r\n") + "\r\n"
}

/** JSON export: full Requirement objects as they are in the database, with an export stamp. */
export function toJson(reqs: Requirement[]): string {
  return JSON.stringify(
    { exported_at: new Date().toISOString(), count: reqs.length, requirements: reqs },
    null,
    2
  )
}

/** Where items would go once the integration is configured in Settings → Integrations. */
export const CODEBEAMER_ENDPOINT = "POST {codebeamer-url}/api/v3/trackers/{trackerId}/items"

const CB_PRIORITY: Record<Priority, string> = { P1: "High", P2: "Normal", P3: "Low" }

/**
 * PTC Codebeamer REST API v3 tracker-item body (shape verified against PTC's v3 API docs:
 * name, description, descriptionFormat, priority/status as ChoiceOptionReference, customFields).
 * The plain-text description keeps everything a reviewer needs to make the call.
 * NOTE: customFields fieldId 0 is a placeholder — real field ids are per tracker and get mapped
 * once the integration is connected (Settings → Integrations).
 */
export function toCodebeamerItem(r: Requirement) {
  const lines: string[] = [r.description]
  if (r.target) lines.push(`Target: ${r.target}`)
  if (r.rationale) lines.push(`Rationale: ${r.rationale}`)
  if (r.assumptions.length) lines.push("Assumptions:", ...r.assumptions.map((a) => `• ${a}`))
  if (r.uncertainties.length) lines.push("Uncertainties:", ...r.uncertainties.map((u) => `• ${u}`))
  lines.push(`Vehicle: ${r.vehicle}; markets: ${r.markets.join(" / ")}; rank: ${r.rank}; score: ${r.score}`)
  lines.push(`Evidence level: ${r.evidence_level}`)
  if (r.sources.length) lines.push(`Sources: ${r.sources.map((s) => s.id).join(", ")}`)
  lines.push(
    `Exported from BMW Backseat; decision: ${STATUS_LABEL[r.status]}${r.status_reason ? ` - ${r.status_reason}` : ""}`
  )
  return {
    name: `${r.code} ${r.title}`,
    description: lines.join("\n"),
    descriptionFormat: "PlainText",
    priority: { name: CB_PRIORITY[effectivePriority(r)], type: "ChoiceOptionReference" },
    status: { name: "New", type: "ChoiceOptionReference" },
    // Tracker-specific field IDs are unknown. Keep traceability in the description, never invent IDs.
    customFields: [],
  }
}
