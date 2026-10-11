// Requirements engine: one "Create requirements" run, the PM's decisions, and the challenge.
// Every change to a requirement is written to requirement_event (who or what, when, before -> after, why).
import { isDeepStrictEqual } from "node:util"
import { FEATURE_MAP_VERSION } from "@/lib/features"
import { DEFAULT_WEIGHTS, DRAFT_MODEL, DRAFT_PROMPT_VERSION, LIMITS, SCORE_VERSION, priorityOf } from "@/lib/requirements/config"
import { DRAFT_ACTOR, chat, draft, evidenceFor, type AiKey } from "@/lib/requirements/draft"
import { admin, buildCandidates, readSignals } from "@/lib/requirements/signals"
import type { GenerateOptions, Priority, ReqStatus, Requirement, UploadedCsv } from "@/lib/requirements/types"
import { vehicleOf } from "@/lib/scope"

const ABBR: Record<string, string> = {
  rear_comfort: "REAR", controls: "CTRL", ev_range_charging: "EV", driving_dynamics: "DRIVE", driver_assist: "ADAS",
  smartphone_app: "APP", voice_assistant: "VOICE", exterior_design: "EXT", interior_quality: "INT", front_seats: "SEAT",
  climate: "CLIM", space_practicality: "SPACE", audio: "AUDIO", head_up_display: "HUD", price_value: "PRICE", reliability: "REL",
}
const codeOf = (vehicle: string, feature: string, kind: string) => `REQ-${vehicle}-${ABBR[feature] ?? feature.toUpperCase()}-${kind.toUpperCase()}`

type Ev = { requirement_id?: string; run_id?: string | null; actor_type: "ai" | "code" | "pm" | "system"; actor: string; action: string; field?: string | null; before?: unknown; after?: unknown; reason?: string | null }

async function log(events: Ev[]) {
  if (!events.length) return
  const { error } = await admin().from("requirement_event").insert(events.map((e) => ({ field: null, before: null, after: null, reason: null, run_id: null, ...e })))
  if (error) throw new Error(`requirement_event: ${error.message}`)
}

export const same = (a: unknown, b: unknown) => isDeepStrictEqual(a ?? null, b ?? null)
async function saveChange(id: string | null, version: number | null, patch: Record<string, unknown>, events: Ev[]): Promise<Requirement> {
  const { data, error } = await admin().rpc("save_requirement_change", {
    p_id: id, p_expected_version: version, p_patch: patch,
    p_events: events.map((e) => ({ field: null, before: null, after: null, reason: null, run_id: null, ...e })),
  })
  if (error) throw new Error(`Requirement change: ${error.message}`)
  return data as Requirement
}

const optsText = (o: GenerateOptions) =>
  `BMW internal data on; public data ${o.public ? "on" : "off"}; research findings ${o.research ? "on" : "off"}; What-If ${o.whatif ? "on" : "off"}`

export async function generate(input: { vehicle: string; options: GenerateOptions; csv: UploadedCsv | null; actor: string; ai: AiKey }) {
  const t0 = Date.now()
  const db = admin()
  const vehicle = vehicleOf(input.vehicle)
  const weights = DEFAULT_WEIGHTS
  const csvRows = (input.csv?.rows ?? []).slice(0, LIMITS.csvMaxRows)

  const { data: runId, error: runErr } = await db.rpc("begin_requirement_run", {
    p_team: !input.ai,
    p_run: { vehicle: vehicle.id, options: input.options, weights, score_version: SCORE_VERSION,
      prompt_version: DRAFT_PROMPT_VERSION, model: input.ai?.model || DRAFT_MODEL,
      csv_name: input.csv?.name ?? null, csv_rows: csvRows.length ? csvRows : null, actor: input.actor },
  })
  if (runErr || !runId) throw new Error(runErr?.message ?? "Could not start requirement run")

  try {
    const sig = await readSignals(vehicle.id)
    const cands = buildCandidates(sig, input.options, weights)
    const drafted = await Promise.all(
      cands.map(async (c) => {
        const evidence = await evidenceFor(c, vehicle.id, sig.countries, csvRows)
        const d = await draft(c, evidence, vehicle.name, input.ai)
        const cited = new Set([...d.draft.supporting_ids, ...d.draft.opposing_ids])
        // Keep every item the model saw; mark the ones it cited first.
        const sources = [...evidence.filter((e) => cited.has(e.id)), ...evidence.filter((e) => !cited.has(e.id))].map((e) =>
          d.draft.opposing_ids.includes(e.id) ? { ...e, role: "opposes" as const } : d.draft.supporting_ids.includes(e.id) ? { ...e, role: "supports" as const } : e
        )
        return { c, d, sources }
      })
    )

    const { data: existingRows, error: exErr } = await db.from("requirement").select("*").eq("vehicle", vehicle.id)
    if (exErr) throw new Error(exErr.message)
    const existing = new Map((existingRows as Requirement[]).map((r) => [`${r.feature_id}:${r.kind}`, r]))

    let created = 0
    let updated = 0
    let unchanged = 0
    let droppedTotal = 0
    const aiActor = DRAFT_ACTOR(input.ai)

    for (const { c, d, sources } of drafted) {
      droppedTotal += d.dropped.length
      const text = {
        title: d.draft.title,
        description: d.draft.description,
        target: d.draft.target,
        rationale: d.draft.rationale,
        assumptions: d.draft.assumptions,
        uncertainties: d.draft.uncertainties,
      }
      const scored = { score: c.score, priority: c.priority, evidence_level: c.evidence_level }
      const old = existing.get(`${c.feature.id}:${c.kind}`)

      if (!old) {
        await saveChange(null, null, {
          code: codeOf(vehicle.id, c.feature.id, c.kind), vehicle: vehicle.id, feature_id: c.feature.id, kind: c.kind,
          ...text, ...scored, conflicts: c.conflicts, markets: c.markets, rank: 0, factors: c.factors, sources, run_id: runId,
        }, [
          { run_id: runId, actor_type: "code", actor: `${SCORE_VERSION} · map ${FEATURE_MAP_VERSION}`, action: "proposed", after: { feature: c.feature.id, kind: c.kind, markets: c.markets }, reason: `Candidate from BMW feedback: ${c.counts.negative} complaints, ${c.counts.want} wishes, ${c.counts.positive} praise. ${optsText(input.options)}.` },
          { run_id: runId, actor_type: "ai", actor: aiActor, action: "drafted", after: text, reason: d.fallback ? "AI draft withheld: no valid citation; template text used" : `${d.draft.supporting_ids.length} supporting, ${d.draft.opposing_ids.length} opposing citations${d.dropped.length ? `; ${d.dropped.length} invalid citation(s) dropped: ${d.dropped.join(", ")}` : ""}` },
          { run_id: runId, actor_type: "code", actor: SCORE_VERSION, action: "scored", after: { ...scored, factors: c.factors, sources }, reason: `Weighted score of ${c.factors.filter((f) => f.included).length} factors` },
        ])
        created++
        continue
      }

      const evs: Ev[] = []
      const patch: Record<string, unknown> = {}
      if (!same([old.score, old.priority, old.evidence_level], [scored.score, scored.priority, scored.evidence_level])) {
        Object.assign(patch, scored)
        evs.push({ requirement_id: old.id, run_id: runId, actor_type: "code", actor: SCORE_VERSION, action: "rescored", field: "score", before: { score: old.score, priority: old.priority, evidence_level: old.evidence_level }, after: scored, reason: `New run (${optsText(input.options)})` })
      }
      if (!same(old.factors, c.factors)) patch.factors = c.factors
      const oldIds = (old.sources ?? []).map((s) => s.id).sort()
      const newIds = sources.map((s) => s.id).sort()
      if (!same(oldIds, newIds)) {
        patch.sources = sources
        const added = newIds.filter((x) => !oldIds.includes(x))
        const removed = oldIds.filter((x) => !newIds.includes(x))
        evs.push({ requirement_id: old.id, run_id: runId, actor_type: "code", actor: SCORE_VERSION, action: "evidence", field: "sources", before: { count: oldIds.length, sources: old.sources }, after: { count: newIds.length, sources, added, removed }, reason: `Evidence set changed (${optsText(input.options)})` })
      } else if (!same(old.sources, sources)) patch.sources = sources
      if (!same(old.conflicts, c.conflicts)) {
        patch.conflicts = c.conflicts
        evs.push({ requirement_id: old.id, run_id: runId, actor_type: "code", actor: SCORE_VERSION, action: "conflicts", field: "conflicts", before: old.conflicts, after: c.conflicts, reason: "Conflicting signals re-checked" })
      }
      if (!same(old.markets, c.markets)) patch.markets = c.markets
      if (old.edited_by_pm) {
        if (!d.fallback && !same(old.title, text.title))
          evs.push({ requirement_id: old.id, run_id: runId, actor_type: "ai", actor: aiActor, action: "redraft_skipped", field: "text", before: null, after: { title: text.title }, reason: "The PM edited this requirement; the AI does not overwrite human text" })
      } else if (!d.fallback) {
        for (const k of ["title", "description", "target"] as const)
          if (!same(old[k], text[k])) evs.push({ requirement_id: old.id, run_id: runId, actor_type: "ai", actor: aiActor, action: "redrafted", field: k, before: old[k], after: text[k], reason: "Redrafted from the current evidence" })
        for (const k of Object.keys(text) as (keyof typeof text)[]) if (!same(old[k], text[k])) patch[k] = text[k]
      }
      if (["approved", "rejected"].includes(old.status) && patch.score !== undefined && Math.abs(Number(patch.score) - old.score) >= 10)
        evs.push({ requirement_id: old.id, run_id: runId, actor_type: "system", actor: "Backseat", action: "flag", reason: `Score moved ${old.score} -> ${patch.score} after the PM's decision (${old.status}); worth a second look` })

      for (const field of Object.keys(patch)) {
        const covered = evs.some((e) => e.field === field || (e.action === "rescored" && ["score", "priority", "evidence_level"].includes(field)))
        if (!covered) evs.push({ requirement_id: old.id, run_id: runId, actor_type: ["title", "description", "target", "rationale", "assumptions", "uncertainties"].includes(field) ? "ai" : "code", actor: ["title", "description", "target", "rationale", "assumptions", "uncertainties"].includes(field) ? aiActor : SCORE_VERSION,
          action: "updated", field, before: old[field as keyof Requirement], after: patch[field], reason: "Recomputed from current run inputs" })
      }
      if (Object.keys(patch).length) {
        await saveChange(old.id, old.version, { ...patch, run_id: runId }, evs)
        updated++
      } else { unchanged++; await log(evs) }
    }

    await rerank(vehicle.id)
    const summary = { created, updated, unchanged, dropped_citations: droppedTotal, candidates: cands.length }
    await db.from("requirement_run").update({ status: "done", duration_ms: Date.now() - t0, summary }).eq("id", runId)
    return { run_id: runId, ...summary }
  } catch (e) {
    await db.from("requirement_run").update({ status: "failed", duration_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }).eq("id", runId)
    throw e
  }
}

async function rerank(vehicle: string) {
  const db = admin()
  const { data, error } = await db.from("requirement").select("id, score, code, rank, version").eq("vehicle", vehicle)
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as { id: string; score: number; code: string; rank: number; version: number }[]).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
  for (const [i, row] of rows.entries()) if (row.rank !== i + 1)
    await saveChange(row.id, row.version, { rank: i + 1 }, [{ requirement_id: row.id, actor_type: "code", actor: SCORE_VERSION,
      action: "ranked", field: "rank", before: row.rank, after: i + 1, reason: "Descending calculated score; stable code breaks ties" }])
}

// ---------- PM actions (human decisions; a reason is required for every one) ----------
export type PmAction =
  | { type: "status"; status: ReqStatus; reason: string }
  | { type: "edit"; fields: Partial<Pick<Requirement, "title" | "description" | "target">>; reason: string }
  | { type: "priority"; priority: Priority | null; reason: string }

export async function pmAction(id: string, action: PmAction, actor: string, expectedVersion?: number) {
  const db = admin()
  const { data: r, error } = await db.from("requirement").select("*").eq("id", id).single()
  if (error || !r) throw new Error("Requirement not found")
  const req = r as Requirement
  if (expectedVersion !== undefined && req.version !== expectedVersion) throw new Error("Requirement changed; refresh and review the latest version")
  const reason = action.reason.trim()
  if (reason.length < LIMITS.reasonMinChars) throw new Error("Give a reason (at least 5 characters). Every decision is logged with its reason.")
  const evs: Ev[] = []
  const patch: Record<string, unknown> = {}

  if (action.type === "status") {
    if (req.status === action.status) throw new Error(`Already ${action.status}`)
    patch.status = action.status
    patch.status_reason = reason
    evs.push({ requirement_id: id, actor_type: "pm", actor, action: "status", field: "status", before: req.status, after: action.status, reason })
  } else if (action.type === "edit") {
    for (const k of ["title", "description", "target"] as const) {
      const v = action.fields[k]
      if (v === undefined) continue
      const nv = typeof v === "string" ? v.trim() || null : v
      if (k !== "target" && !nv) throw new Error(`${k} cannot be empty`)
      if (same(req[k], nv)) continue
      patch[k] = nv
      evs.push({ requirement_id: id, actor_type: "pm", actor, action: "edited", field: k, before: req[k], after: nv, reason })
    }
    if (!evs.length) throw new Error("Nothing changed")
    patch.edited_by_pm = true
  } else {
    if (same(req.priority_override, action.priority)) throw new Error("Priority unchanged")
    patch.priority_override = action.priority
    evs.push({ requirement_id: id, actor_type: "pm", actor, action: "priority_override", field: "priority", before: req.priority_override ?? `${req.priority} (score)`, after: action.priority ?? `${priorityOf(req.score)} (score)`, reason })
  }
  await saveChange(id, req.version, patch, evs)
  return { ok: true }
}

// ---------- Challenge: the AI looks for counter-evidence in what the requirement already cites ----------
type Challenge = { verdict: "holds" | "weakened" | "not_supported"; summary: string; counter_ids: string[] }

export async function challenge(id: string, actor: string, ai: AiKey, reason: string) {
  const db = admin()
  const { data: r, error } = await db.from("requirement").select("*").eq("id", id).single()
  if (error || !r) throw new Error("Requirement not found")
  const req = r as Requirement
  const { error: reserved } = await db.rpc("reserve_requirement_challenge", { p_id: id, p_actor: actor, p_reason: reason, p_team: !ai })
  if (reserved) throw new Error(reserved.message)
  const ids = new Set(req.sources.map((s) => s.id))
  const res = await chat<Challenge>(
    `You are a sceptical reviewer at a BMW product gate. Your job is to argue AGAINST the requirement below using only the evidence listed. ` +
      `Look for: customers who say the opposite, study results with no gap, markets where the signal is missing, rival data that does not support it, simulated or unverified sources being relied on, and assumptions that may not hold by 2030. ` +
      `verdict: holds (counter-evidence is weak), weakened (real counter-evidence; PM should look), not_supported (the evidence does not carry the requirement). ` +
      `summary: two to four plain sentences, citing IDs in square brackets. counter_ids: IDs of the counter-evidence. Never invent evidence or numbers. No em dashes.`,
    [
      `Requirement ${req.code} (${req.kind}): ${req.title}. ${req.description}`,
      req.target ? `Target: ${req.target}` : "",
      `Score ${req.score}, ${req.priority}, evidence level ${req.evidence_level}.`,
      `Factors:\n${req.factors.map((f) => `- ${f.label}: ${f.value ?? "n/a"}. ${f.detail}`).join("\n")}`,
      req.conflicts.length ? `Conflicts found by code:\n${req.conflicts.map((c) => `- ${c}`).join("\n")}` : "",
      `Assumptions: ${req.assumptions.join(" | ") || "none"}`,
      `Evidence:\n${req.sources.map((s) => `[${s.id}] (${s.label}; role ${s.role}) ${s.text ?? ""}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "challenge",
    {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "summary", "counter_ids"],
      properties: { verdict: { type: "string", enum: ["holds", "weakened", "not_supported"] }, summary: { type: "string" }, counter_ids: { type: "array", items: { type: "string" } } },
    },
    ai
  )
  const cited = [...res.counter_ids, ...[...res.summary.matchAll(/\[([^\]\s]+)\]/g)].map((m) => m[1])]
  const dropped = [...new Set(cited.filter((x) => !ids.has(x)))]
  const summary = res.summary.replace(/\[([^\]\s]+)\]/g, (tag, id) => ids.has(id) ? tag : "[citation withheld]")
  const out = { verdict: res.verdict, summary, counter_ids: res.counter_ids.filter((x) => ids.has(x)) }
  await log([{ requirement_id: id, actor_type: "ai", actor: `${DRAFT_ACTOR(ai)} · challenge`, action: "challenged", after: out, reason: `${reason}. Requested by ${actor}${dropped.length ? `; ${dropped.length} invalid citation(s) dropped` : ""}` }])
  return out
}
