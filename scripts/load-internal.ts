// db-loader: copy cleaned BMW data files into the 8 internal snapshot tables, then verify counts.
// Run: npx tsx --env-file=/Users/abhinavsingh/Documents/codes/ehl-hackathon/.env.local scripts/load-internal.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
const R = "/Users/abhinavsingh/Documents/codes/ehl-hackathon";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key, { auth: { persistSession: false } });

function readJson(p: string): any {
  return JSON.parse(readFileSync(p, "utf8"));
}
function must(error: any, ctx: string) {
  if (error) throw new Error(`supabase error in ${ctx}: ${error.message} (${JSON.stringify(error)}`.slice(0, 500));
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
async function upsertBatched(table: string, rows: any[], onConflict: string, ctx: string) {
  for (const b of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(b, { onConflict });
    must(error, `upsert ${table} (${ctx})`);
  }
}

// ---------------------------------------------------------------- CSV parse
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  // ------------------------------------------------------------ load sources
  const comments: any[] = readJson(path.join(R, "data/clean/feedback_comments.json"));
  const studiesCsv = readFileSync(path.join(R, "research/data/E_studies_long.csv"), "utf8");
  const fItems: any[] = readJson(path.join(R, "research/data/F_items.json"));
  const fVariants: any[] = readJson(path.join(R, "research/data/F_variants.json"));

  // ------------------------------------------------- STEP 1: feedback_comment
  const commentRows = comments.map((c) => ({
    comment_id: c.comment_id,
    model: c.model,
    source: c.source,
    country: c.country ?? null,
    engine_type: c.engine_type ?? null,
    text: c.text_raw,
    is_agent_transcribed: !!c.is_agent_transcribed,
    us_only_source: !!c.us_only_source,
  }));
  await upsertBatched("feedback_comment", commentRows, "comment_id", "step1");
  console.log(`step1 feedback_comment: ${commentRows.length} rows upserted`);

  // ---------------------------------------- STEP 2: feedback_label + offset
  const feedbackWbs: Record<string, ExcelJS.Worksheet> = {};
  for (const m of ["G60", "G70", "F70"]) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(R, `BMW-Data/${m}_feedback_hackathon.xlsx`));
    const ws = wb.worksheets[0];
    // find header row = first row whose cell text contains "Customer Feedback"
    let headerRow = 0;
    let fbCol = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (headerRow) return;
      row.eachCell((cell, colNum) => {
        if (!headerRow && String(cell.value ?? "").trim() === "Customer Feedback") {
          headerRow = rowNum;
          fbCol = colNum;
        }
      });
    });
    if (!headerRow) throw new Error(`no "Customer Feedback" header found in ${m}_feedback_hackathon.xlsx`);
    feedbackWbs[m] = ws;
    (feedbackWbs as any)[m + "_meta"] = { headerRow, fbCol };
  }
  // OFFSET: excel_row = row_index + OFFSET. Expected header row + 1-based + 0-based gap.
  // Determine it from the first data row of each model.
  const cellText = (m: string, excelRow: number): string => {
    const ws = feedbackWbs[m];
    const meta = (feedbackWbs as any)[m + "_meta"];
    const v = ws.getRow(excelRow).getCell(meta.fbCol).value;
    if (v == null) return "";
    if (v instanceof Date) return String(v);
    if (typeof v === "object" && "richText" in (v as any)) return (v as any).richText.map((t: any) => t.text).join("");
    if (typeof v === "object" && "result" in (v as any)) return String((v as any).result ?? "");
    return String(v);
  };
  // candidate offsets: headerRow + 1 (first data row for row_index 0)
  const meta0 = (feedbackWbs as any)["G60_meta"];
  const offset = meta0.headerRow + 1; // header row 1 -> data starts at row 2 -> offset 2

  // spot checks: 10 labels spread across all 3 models
  const spot: { m: string; comment_id: string; row_index: number; }[] = [];
  const byModel: Record<string, any[]> = { G60: [], G70: [], F70: [] };
  for (const c of comments) byModel[c.model].push(c);
  for (const m of ["G60", "G70", "F70"]) {
    const arr = byModel[m];
    const idxs = [0, Math.floor(arr.length / 3), Math.floor((2 * arr.length) / 3), arr.length - 1];
    for (const i of idxs.slice(0, m === "G60" ? 4 : 3)) spot.push({ m, comment_id: arr[i].comment_id, row_index: arr[i].labels[0].row_index });
  }
  // 10th from a mid label of G60
  spot.push({ m: "G60", comment_id: byModel["G60"][Math.floor(byModel["G60"].length / 2)].comment_id, row_index: byModel["G60"][Math.floor(byModel["G60"].length / 2)].labels[0].row_index });
  const spotResults: string[] = [];
  const failures: string[] = [];
  for (const s of spot) {
    const c = comments.find((x) => x.comment_id === s.comment_id)!;
    const got = cellText(s.m, s.row_index + offset).trim();
    const want = c.text_raw.trim();
    const ok = got === want;
    spotResults.push(`${s.comment_id} row_index=${s.row_index} excel_row=${s.row_index + offset}: ${ok ? "OK" : "MISMATCH"}`);
    if (!ok) failures.push(`${s.comment_id} (model ${s.m}, excel_row ${s.row_index + offset}): expected ${JSON.stringify(want.slice(0, 60))}, cell has ${JSON.stringify(got.slice(0, 60))}`);
  }
  console.log(`excel_row OFFSET found: ${offset}`);
  spotResults.forEach((s) => console.log("  spot:", s));
  if (failures.length) {
    console.error("OFFSET SPOT CHECK FAILED:");
    failures.forEach((f) => console.error("  " + f));
    process.exit(1);
  }

  const labelRows: any[] = [];
  for (const c of comments) {
    for (const l of c.labels ?? []) {
      labelRows.push({
        comment_id: c.comment_id,
        row_index: l.row_index,
        excel_row: l.row_index + offset,
        feedback_type: l.feedback_type ?? null,
        sentiment: l.sentiment,
        level2: l.level2 ?? null,
        level3: l.level3 ?? null,
        vfc: l.vfc_combined ?? null,
      });
    }
  }
  await upsertBatched("feedback_label", labelRows, "comment_id,row_index", "step2");
  console.log(`step2 feedback_label: ${labelRows.length} rows upserted`);

  // ------------------------------------------------- STEP 3: study_metric
  const csvLines = studiesCsv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const csvHeader = splitCsvLine(csvLines[0]).map((h) => h.trim());
  const col = (name: string) => {
    const i = csvHeader.indexOf(name);
    if (i === -1) throw new Error(`csv column ${name} not found`);
    return i;
  };
  const idx = Object.fromEntries(["sheet", "market", "model", "attribute", "metric", "value", "n_if_available", "source_cell"].map((k) => [k, col(k)]));
  const studyRows = csvLines.slice(1).map((line) => {
    const f = splitCsvLine(line);
    const val = f[idx.value].trim();
    const n = f[idx.n_if_available].trim();
    return {
      sheet: f[idx.sheet],
      market: f[idx.market],
      model: f[idx.model],
      attribute: f[idx.attribute],
      metric: f[idx.metric],
      value: val === "" ? null : Number(val),
      n: n === "" ? null : parseInt(n, 10),
      source_cell: f[idx.source_cell],
    };
  });
  await upsertBatched("study_metric", studyRows, "sheet,market,model,attribute,metric", "step3");
  console.log(`step3 study_metric: ${studyRows.length} rows upserted`);

  // ------------------------------------------------- STEP 4: option_item
  await supabase.from("option_item").delete().gt("id", 0).then(({ error }) => must(error, "delete option_item"));
  const itemRows = fItems.map((it) => ({
    model: it.model,
    page: it.page,
    page_title: it.page_title ?? null,
    kind: it.kind ?? null,
    section: it.section ?? null,
    name: it.name,
    code: it.code ?? null,
    condition: it.condition ?? null,
    price_gross: it.price_gross ?? null,
    price_net: it.price_net ?? null,
    price_note: it.price_note ?? null,
    marks: it.marks ?? {},
    description: it.description ?? null,
    constraints: it.constraints ?? [],
  }));
  await upsertBatched("option_item", itemRows, "id", "step4");
  console.log(`step4 option_item: ${itemRows.length} rows inserted`);

  // ------------------------------------------------- STEP 5: vehicle_variant
  const variantRows = fVariants.map((v) => ({
    model: v.model,
    variant: v.variant,
    page: v.page,
    fuel: v.fuel ?? null,
    power_kw: v.power_kw ?? null,
    power_ps: v.power_ps ?? null,
    base_price_eur_gross: v.base_price_eur_gross ?? null,
  }));
  await upsertBatched("vehicle_variant", variantRows, "model,variant", "step5");
  console.log(`step5 vehicle_variant: ${variantRows.length} rows upserted`);

  // ------------------------------------------------- STEP 6: sales_volume
  // shortcut: exceljs does not expose cached formula values in this file; openpyxl data_only does
  const pyScript = `
import json, openpyxl
wb = openpyxl.load_workbook(r"${R}/BMW-Data/sales_volumes.xlsx", data_only=True)
rows = []
for ws in wb.worksheets:
    for r in range(2, 6):
        mc = ws.cell(row=r, column=2).value
        if mc is None or str(mc).strip() == "":
            continue
        rows.append([ws.title, str(mc).strip(), ws.cell(row=r, column=3).value, ws.cell(row=r, column=4).value, ws.cell(row=r, column=5).value])
print(json.dumps(rows))
`;
  const salesRaw = execFileSync(
    "/Users/abhinavsingh/Documents/codes/ehl-hackathon/.venv/bin/python",
    ["-c", pyScript],
    { encoding: "utf8" },
  );
  const salesParsed: [string, string, number | null, number | null, number | null][] = JSON.parse(salesRaw.trim());
  const salesRows: any[] = [];
  for (const [sheet, market, v2024, v2025, v2030] of salesParsed) {
    for (const [year, v] of [[2024, v2024], [2025, v2025], [2030, v2030]] as const) {
      if (v == null) continue;
      salesRows.push({ sheet, market, year, volume: Number(v), is_forecast: year === 2030 });
    }
  }
  // sanity check against known values
  const sc = (sheet: string, market: string, year: number) =>
    salesRows.find((r) => r.sheet === sheet && r.market === market && r.year === year)?.volume;
  const checks: [string, number | undefined, number][] = [
    ["G60_G68 CN 2024", sc("G60_G68", "CN", 2024), 68000],
    ["G60_G68 CN 2025", sc("G60_G68", "CN", 2025), 75000],
    ["G60_G68 US 2024", sc("G60_G68", "US", 2024), 75600],
    ["F70 CN 2024", sc("F70", "CN", 2024), 0],
    ["F70 CN 2025", sc("F70", "CN", 2025), 0],
    ["F70 CN 2030", sc("F70", "CN", 2030), 0],
  ];
  for (const [name, got, want] of checks) {
    if (got !== want) throw new Error(`sales_volume check failed: ${name} expected ${want} got ${got}`);
  }
  console.log("sales_volume sanity checks: all OK");
  await upsertBatched("sales_volume", salesRows, "sheet,market,year", "step6");
  console.log(`step6 sales_volume: ${salesRows.length} rows upserted`);

  // ------------------------------------------------- STEP 7: persona + evidence
  const personaFiles = ["AM-1", "AM-2", "AM-3", "EU-1", "EU-2", "EU-3", "AS-1", "AS-2", "AS-3"];
  const personaRows: any[] = [];
  const evidenceMap = new Map<string, { persona_id: string; comment_id: string; role: string | null }>();
  for (const pid of personaFiles) {
    const p = readJson(path.join(R, `personas/${pid}.json`));
    personaRows.push({
      id: p.persona_id,
      model: "G60",
      name: p.name,
      label: p.label,
      region: p.region,
      market: String(p.market),
      evidence_tier: String(p.evidence_tier),
      profile: p,
    });
    for (const q of p.feedback_evidence_quotes ?? []) {
      evidenceMap.set(`${p.persona_id}|${q.quote_id}`, { persona_id: p.persona_id, comment_id: q.quote_id, role: q.role ?? null });
    }
  }
  await upsertBatched("persona", personaRows, "id", "step7a");
  const evidenceRows = [...evidenceMap.values()];
  await upsertBatched("persona_evidence", evidenceRows, "persona_id,comment_id", "step7b");
  console.log(`step7 persona: ${personaRows.length}, persona_evidence: ${evidenceRows.length} (unique pairs)`);

  // ------------------------------------------------- VERIFY
  const expected: Record<string, number> = {
    feedback_comment: commentRows.length,
    feedback_label: labelRows.length,
    study_metric: studyRows.length,
    option_item: itemRows.length,
    vehicle_variant: variantRows.length,
    sales_volume: salesRows.length,
    persona: personaRows.length,
    persona_evidence: evidenceRows.length,
  };
  let allOk = true;
  console.log("\ntable expected actual OK|MISMATCH");
  for (const [t, exp] of Object.entries(expected)) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    must(error, `count ${t}`);
    const ok = count === exp;
    if (!ok) allOk = false;
    console.log(`${t} ${exp} ${count} ${ok ? "OK" : "MISMATCH"}`);
  }
  console.log(`\nexcel_row OFFSET: ${offset}`);
  spotResults.forEach((s) => console.log("spot:", s));
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
