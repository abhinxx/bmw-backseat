// Clean the three feedback workbooks into one record per comment, then prove the
// result is lossless by rebuilding every original row and comparing cell by cell.
// Rules: research/D_feedback_audit.md section 9.
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";

const MODELS = ["G60", "G70", "F70"] as const;
type Model = (typeof MODELS)[number];

const COLS = [
  "ID", "Source", "Brand", "Sales Description", "Country", "Derivate (e-code)",
  "Engine Type", "Feedback Type", "Customer Feedback",
  "Vfc level2 3 Name", "Vfc level2 Name", "Vfc level3 Name",
] as const;
type Row = Record<(typeof COLS)[number], string | null>;

type Sentiment = "positive" | "negative" | "want" | "unknown";
const SENTIMENT: Record<string, Sentiment> = {
  Likes: "positive",
  "Difficult to Use": "negative",
  Defect: "negative",
  Wants: "want",
};

export interface Label {
  row_index: number; // position in the original sheet (0-based, data rows only)
  feedback_type: string | null;
  sentiment: Sentiment;
  level2: string | null;
  level3: string | null;
  vfc_combined: string | null; // rebuilt as level2 + " : " + level3
  vfc_raw: string | null; // sheet value, kept for the round-trip check
  is_no_class_found: boolean;
  is_dislike_as_want: boolean; // "Dislike:" level3 coded as Wants (audit section 4)
}

export interface Comment {
  comment_id: string;
  model: Model;
  source: string; // "A" | "B" | "C" | "D"
  country: string;
  engine_type: string; // ICE | BEVE | PHEV
  text_raw: string;
  text_norm: string;
  is_agent_transcribed: boolean;
  us_only_source: boolean;
  labels: Label[];
  has_label: boolean;
  sentiments: Sentiment[]; // distinct, across labels
}

// Constant columns (audit: one value per file), kept so rows can be rebuilt.
interface ModelMeta { brand: string; sales_description: string; derivate: string }

const cell = (v: ExcelJS.CellValue): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  const s = String(v);
  return s === "" ? null : s;
};

async function readRows(model: Model): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`BMW-Data/${model}_feedback_hackathon.xlsx`);
  const ws = wb.getWorksheet("Feedback_Explorer");
  if (!ws) throw new Error(`${model}: sheet Feedback_Explorer missing`);
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(cell);
  if (JSON.stringify(header) !== JSON.stringify(COLS)) throw new Error(`${model}: unexpected header ${header}`);
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const row = {} as Row;
    COLS.forEach((c, i) => (row[c] = cell(r.getCell(i + 1).value)));
    rows.push(row);
  });
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function clean(model: Model, rows: Row[]): { comments: Comment[]; meta: ModelMeta } {
  const meta: ModelMeta = {
    brand: rows[0].Brand!,
    sales_description: rows[0]["Sales Description"]!,
    derivate: rows[0]["Derivate (e-code)"]!,
  };
  const byId = new Map<string, Comment>();
  rows.forEach((r, i) => {
    if (r.Brand !== meta.brand || r["Sales Description"] !== meta.sales_description || r["Derivate (e-code)"] !== meta.derivate)
      throw new Error(`${model} row ${i}: constant column varies`);
    const id = r.ID!;
    let c = byId.get(id);
    if (!c) {
      const source = r.Source!.replace(/^Source /, "");
      c = {
        comment_id: id,
        model,
        source,
        country: r.Country!,
        engine_type: r["Engine Type"]!,
        text_raw: r["Customer Feedback"]!,
        text_norm: norm(r["Customer Feedback"]!),
        is_agent_transcribed: source === "B" && /^customer /i.test(r["Customer Feedback"]!.trim()),
        us_only_source: source !== "A",
        labels: [],
        has_label: false,
        sentiments: [],
      };
      byId.set(id, c);
    } else if (c.source !== r.Source!.replace(/^Source /, "") || c.country !== r.Country || c.engine_type !== r["Engine Type"] || c.text_raw !== r["Customer Feedback"]) {
      throw new Error(`${model} ${id}: comment-level field differs between rows`);
    }
    const l2 = r["Vfc level2 Name"], l3 = r["Vfc level3 Name"], ft = r["Feedback Type"];
    c.labels.push({
      row_index: i,
      feedback_type: ft,
      sentiment: ft ? SENTIMENT[ft] ?? "unknown" : "unknown",
      level2: l2,
      level3: l3,
      vfc_combined: l2 && l3 ? `${l2} : ${l3}` : l2,
      vfc_raw: r["Vfc level2 3 Name"],
      is_no_class_found: l2 === "no_class_found",
      is_dislike_as_want: !!l3?.startsWith("Dislike:") && ft === "Wants",
    });
  });
  for (const c of byId.values()) {
    c.has_label = c.labels.some((l) => l.level2 && !l.is_no_class_found);
    c.sentiments = [...new Set(c.labels.map((l) => l.sentiment))];
  }
  return { comments: [...byId.values()], meta };
}

// Rebuild every original row from the clean records and compare all 12 cells.
function verify(model: Model, rows: Row[], comments: Comment[], meta: ModelMeta): number {
  const rebuilt: Row[] = new Array(rows.length);
  for (const c of comments)
    for (const l of c.labels)
      rebuilt[l.row_index] = {
        ID: c.comment_id,
        Source: `Source ${c.source}`,
        Brand: meta.brand,
        "Sales Description": meta.sales_description,
        Country: c.country,
        "Derivate (e-code)": meta.derivate,
        "Engine Type": c.engine_type,
        "Feedback Type": l.feedback_type,
        "Customer Feedback": c.text_raw,
        "Vfc level2 3 Name": l.vfc_raw,
        "Vfc level2 Name": l.level2,
        "Vfc level3 Name": l.level3,
      };
  let mismatches = 0;
  rows.forEach((r, i) => {
    for (const col of COLS)
      if (rebuilt[i]?.[col] !== r[col]) {
        if (mismatches++ < 5) console.error(`${model} row ${i} ${col}: ${JSON.stringify(r[col])} vs ${JSON.stringify(rebuilt[i]?.[col])}`);
      }
  });
  return mismatches;
}

const all: Comment[] = [];
const summary: Record<string, unknown> = {};
let failed = false;
for (const model of MODELS) {
  const rows = await readRows(model);
  const { comments, meta } = clean(model, rows);
  const mismatches = verify(model, rows, comments, meta);
  const vfcFixed = comments.flatMap((c) => c.labels).filter((l) => l.vfc_raw !== l.vfc_combined).length;
  summary[model] = { rows: rows.length, comments: comments.length, cells_checked: rows.length * COLS.length, mismatches, vfc_rebuilt_differs: vfcFixed, meta };
  console.log(`${model}: ${rows.length} rows -> ${comments.length} comments, ${rows.length * COLS.length} cells checked, ${mismatches} mismatches, ${vfcFixed} vfc strings rebuilt`);
  if (mismatches) failed = true;
  all.push(...comments);
}
if (failed) {
  console.error("Round-trip check FAILED; nothing written.");
  process.exit(1);
}
mkdirSync("data/clean", { recursive: true });
writeFileSync("data/clean/feedback_comments.json", JSON.stringify(all));
writeFileSync("data/clean/feedback_summary.json", JSON.stringify(summary, null, 2));
console.log(`Wrote ${all.length} comments to data/clean/feedback_comments.json`);
