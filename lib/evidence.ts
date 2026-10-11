// Read-only lookup of one raw evidence record for the /evidence/<kind>/<id> page.
// Independent client so this page never depends on the dashboard queries in lib/data.ts.
import { createClient } from "@supabase/supabase-js"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

export type EvidenceTable = { columns: string[]; rows: string[][] }

export type Evidence = {
  kind: string
  title: string
  fields: [label: string, value: string][]
  body: string | null
  source: { label: string; url: string | null }
  extra?: EvidenceTable
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v))
const yesNo = (v: boolean | null) => (v ? "yes" : "no")

async function commentEvidence(id: string): Promise<Evidence | null> {
  const comment = must(
    await db
      .from("feedback_comment")
      .select("comment_id, model, source, country, engine_type, text, is_agent_transcribed, us_only_source")
      .eq("comment_id", id)
      .maybeSingle(),
    "feedback_comment"
  ) as Record<string, any> | null
  if (!comment) return null

  const labels = must(
    await db
      .from("feedback_label")
      .select("excel_row, feedback_type, sentiment, level2, level3, vfc")
      .eq("comment_id", id)
      .order("row_index", { ascending: true }),
    "feedback_label"
  ) as Record<string, any>[]

  const excelRows = [...new Set(labels.map((l) => str(l.excel_row)))]

  return {
    kind: "comment",
    title: id,
    fields: [
      ["Model", str(comment.model)],
      ["Country", str(comment.country)],
      ["Engine type", str(comment.engine_type)],
      ["Source", "Source " + str(comment.source)],
      ["Agent-transcribed", yesNo(comment.is_agent_transcribed)],
      ["US-only source", yesNo(comment.us_only_source)],
    ],
    body: str(comment.text),
    source: { label: `${comment.model}_feedback_hackathon.xlsx, Excel rows ${excelRows.join(", ")}`, url: null },
    extra: {
      columns: ["Excel row", "Feedback type", "Sentiment", "Class (level2)", "Detail (level3)"],
      rows: labels.map((l) => [str(l.excel_row), str(l.feedback_type), str(l.sentiment), str(l.level2), str(l.level3)]),
    },
  }
}

async function studyEvidence(id: string): Promise<Evidence | null> {
  const rows = must(
    await db
      .from("study_metric")
      .select("market, model, attribute, metric, value")
      .eq("source_cell", id)
      .order("id", { ascending: true }),
    "study_metric"
  ) as Record<string, any>[]
  if (rows.length === 0) return null

  return {
    kind: "study",
    title: id,
    fields: [],
    body: null,
    source: { label: `F70_G60_G68_G70_customer_studies.xlsx, ${id}`, url: null },
    extra: {
      columns: ["Market", "Model", "Attribute", "Metric", "Value"],
      rows: rows.map((r) => [str(r.market), str(r.model), str(r.attribute), str(r.metric), str(r.value)]),
    },
  }
}

async function optionEvidence(id: string): Promise<Evidence | null> {
  const i = id.indexOf("-")
  if (i <= 0) return null
  const model = id.slice(0, i)
  const code = id.slice(i + 1)

  const rows = must(
    await db
      .from("option_item")
      .select("name, code, description, kind, section, condition, price_gross, page")
      .eq("model", model)
      .eq("code", code)
      .order("id", { ascending: true }),
    "option_item"
  ) as Record<string, any>[]
  if (rows.length === 0) return null

  const first = rows[0]
  const prices = [...new Set(rows.map((r) => str(r.price_gross)).filter(Boolean))]
  const pages = [...new Set(rows.map((r) => str(r.page)))]

  return {
    kind: "option",
    title: `${first.name} (${code})`,
    fields: [
      ["Price EUR", prices.join(" / ")],
      ["Kind", str(first.kind)],
      ["Section", str(first.section)],
      ["Condition", str(first.condition)],
    ],
    body: first.description ? str(first.description) : null,
    source: { label: `${model}_OptionList.PDF, page ${pages.join(", ")}`, url: null },
  }
}

async function publicEvidence(id: string): Promise<Evidence | null> {
  const row = must(
    await db
      .from("external_finding")
      .select(
        "id, source_id, kind, topic, subject, title, stance, value, unit, year, quote, quote_translation, source_name, source_url, source_page, source_type, published_date, market"
      )
      .eq("id", id)
      .maybeSingle(),
    "external_finding"
  ) as Record<string, any> | null
  if (!row) return null

  const fields: [string, string][] = [
    ["Type", str(row.kind)],
    ["Topic", str(row.topic)],
    ["Stance", str(row.stance)],
    ["Value", row.value !== null && row.value !== undefined ? `${str(row.value)} ${str(row.unit)}`.trim() : ""],
    ["Year", str(row.year)],
    ["Market", str(row.market)],
  ]
  if (row.quote_translation) fields.push(["English translation", str(row.quote_translation)])
  fields.push(["Published", row.published_date ? str(row.published_date) : "not given"])

  return {
    kind: "public",
    title: str(row.title),
    fields,
    body: row.quote ? str(row.quote) : null,
    source: {
      label: str(row.source_name) + (row.source_page ? ", page " + str(row.source_page) : ""),
      url: row.source_url ? str(row.source_url) : null,
    },
  }
}

export async function getEvidence(kind: string, id: string): Promise<Evidence | null> {
  switch (kind) {
    case "comment":
      return commentEvidence(id)
    case "study":
      return studyEvidence(id)
    case "option":
      return optionEvidence(id)
    case "public":
      return publicEvidence(id)
    default:
      return null
  }
}
