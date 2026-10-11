// external-loader: load public-evidence JSON files (data/external/) into
// external_source, external_finding and search_trend, then verify counts.
// Run from the worktree root:
//   DATA_ROOT=/Users/abhinavsingh/Documents/codes/ehl-hackathon npx tsx --env-file=/Users/abhinavsingh/Documents/codes/ehl-hackathon/.env.local scripts/load-external.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.env.DATA_ROOT ?? path.resolve(import.meta.dirname, "..");

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

const SEGMENT_MARKET: Record<string, string> = {
  Europe: "EU",
  Germany: "DE",
  UK: "UK",
  USA: "US",
  China: "CN",
  Americas: "Americas",
  Asia: "Asia",
};

interface SourceRow {
  source: any; // external_source row
  findings: any[]; // external_finding rows
}

function loadOwner(file: any, sourceId: string, market: string | null): any[] {
  return (file.findings ?? []).map((f: any) => ({
    id: `${sourceId}:${f.id}`,
    source_id: sourceId,
    kind: "owner_quote",
    vehicle: "G60",
    market,
    topic: f.theme ?? null,
    subject: null,
    title: f.summary,
    stance: f.stance ?? null,
    quote: f.quote ?? null,
    quote_translation: f.quote_en ?? null,
    source_name: f.source_name ?? null,
    source_url: f.url ?? null,
    source_type: f.source_type ?? null,
    published_date: f.published_date ?? null,
    raw: f,
  }));
}

async function main() {
  const dir = path.join(ROOT, "data/external");
  const now = new Date().toISOString();
  const sources: SourceRow[] = [];

  // ---------------------------------------------------- A: BMW Group Report 2025
  const aFile = "bmw_report_2025.json";
  if (existsSync(path.join(dir, aFile))) {
    const a = readJson(path.join(dir, aFile));
    const findings: any[] = [];
    for (const m of a.metrics ?? []) {
      findings.push({
        id: `bmw_report_2025:${m.id}`,
        source_id: "bmw_report_2025",
        kind: "metric",
        vehicle: String(m.segment ?? "").includes("5 Series") ? "G60" : null,
        market: SEGMENT_MARKET[m.segment] ?? "global",
        topic: m.group,
        subject: m.segment,
        title: m.metric,
        value: m.value ?? null,
        unit: m.unit ?? null,
        year: m.year ?? null,
        quote: m.quote ?? null,
        source_name: "BMW Group Report 2025",
        source_url: null,
        source_page: m.page ?? null,
        source_type: "company_report",
        raw: m,
      });
    }
    for (const s of a.statements ?? []) {
      findings.push({
        id: `bmw_report_2025:${s.id}`,
        source_id: "bmw_report_2025",
        kind: "statement",
        vehicle: String(s.text ?? "").includes("5 Series") ? "G60" : null,
        market: null,
        topic: s.topic,
        subject: s.group,
        title: s.topic,
        quote: s.text,
        source_name: "BMW Group Report 2025",
        source_page: s.page ?? null,
        source_type: "company_report",
        raw: s,
      });
    }
    sources.push({
      source: {
        id: "bmw_report_2025",
        title: "BMW Group Report 2025",
        method: "Text layer of the public PDF, page by page; every value and sentence copied by script and checked against the page text",
        collected_at: now,
        record_count: findings.length,
        file: `data/external/${aFile}`,
      },
      findings,
    });
  } else console.log(`SKIP ${aFile} (missing)`);

  // ---------------------------------------------------- B: owner voice (US/global)
  const bFile = "owner_voice_g60.json";
  if (existsSync(path.join(dir, bFile))) {
    const b = readJson(path.join(dir, bFile));
    sources.push({
      source: {
        id: "owner_voice_g60",
        title: "Owner voices: 5 Series G60 / i5 (Reddit, bimmerpost)",
        method: b.method,
        collected_at: b.generated_at,
        file: `data/external/${bFile}`,
      },
      findings: loadOwner(b, "owner_voice_g60", null),
    });
  } else console.log(`SKIP ${bFile} (missing)`);

  // ---------------------------------------------------- C: market trends + Google Trends
  const cFile = "market_trends.json";
  let cGeneratedAt: string | null = null;
  let trendRows: any[] = [];
  if (existsSync(path.join(dir, cFile))) {
    const c = readJson(path.join(dir, cFile));
    cGeneratedAt = c.generated_at;
    const findings = (c.findings ?? []).map((f: any) => ({
      id: `market_trends:${f.id}`,
      source_id: "market_trends",
      kind: "trend",
      vehicle: String(f.claim ?? "").includes("5 Series") ? "G60" : null,
      topic: f.topic,
      subject: f.source_org ?? null,
      title: f.claim,
      quote: f.quote ?? null,
      source_name: f.source_org ?? null,
      source_url: f.url ?? null,
      source_type: f.source_type ?? null,
      published_date: f.published_date ?? null,
      raw: f,
    }));
    sources.push({
      source: {
        id: "market_trends",
        title: "Market and consumer trends (J.D. Power, Deloitte, McKinsey, ACEA, Euro NCAP, press)",
        method: "Linkup /search depth=standard; quotes verbatim from returned content",
        collected_at: c.generated_at,
        file: `data/external/${cFile}`,
      },
      findings,
    });
    sources.push({
      source: {
        id: "google_trends",
        title: "Google search interest (Google Trends via pytrends, unofficial)",
        method: "pytrends interest_over_time, monthly, 0-100 relative per region",
        collected_at: c.generated_at,
        file: `data/external/${cFile}`,
      },
      findings: [],
    });
    const gt = c.google_trends;
    if (gt?.regions) {
      for (const [region, rv] of Object.entries<any>(gt.regions)) {
        if (rv.status !== "ok") continue;
        for (const [keyword, series] of Object.entries<any>(rv.series ?? {})) {
          for (const [ym, v] of Object.entries<any>(series)) {
            if (v == null) continue;
            trendRows.push({ region, keyword, month: `${ym}-01`, value: Math.round(Number(v)) });
          }
        }
      }
    }
  } else console.log(`SKIP ${cFile} (missing)`);

  // ---------------------------------------------------- D: competitors
  const dFile = "competitors_g60.json";
  if (existsSync(path.join(dir, dFile))) {
    const d = readJson(path.join(dir, dFile));
    const findings: any[] = [];
    for (const comp of d.competitors ?? []) {
      for (const [keyName, feat] of Object.entries<any>(comp.features ?? {})) {
        findings.push({
          id: `competitors_g60:${comp.id}:${keyName}`,
          source_id: "competitors_g60",
          kind: "competitor_feature",
          topic: keyName,
          subject: comp.id,
          title: String(feat?.value ?? "unknown"),
          quote: feat?.note ?? null,
          value: typeof feat?.value === "number" ? feat.value : null,
          source_name: feat?.source_name ?? null,
          source_url: feat?.source_url ?? null,
          source_type: feat?.source_type ?? null,
          raw: { competitor: comp.name, feature: feat },
        });
      }
    }
    sources.push({
      source: {
        id: "competitors_g60",
        title: "Competitor equipment (E-Class, A6 e-tron, ES90, G80, SU7)",
        method: d.method,
        collected_at: d.generated_at,
        file: `data/external/${dFile}`,
      },
      findings,
    });
  } else console.log(`SKIP ${dFile} (missing)`);

  // ---------------------------------------------------- E/F: China + Europe voices
  for (const [fName, sourceId, title, market] of [
    ["china_voice_g60.json", "china_voice_g60", "Owner voices China: 5 Series Li (G68)", "CN"],
    ["europe_voice_g60.json", "europe_voice_g60", "Owner voices Europe: 5 Series G60 / i5", "EU"],
  ] as const) {
    if (existsSync(path.join(dir, fName))) {
      const e = readJson(path.join(dir, fName));
      sources.push({
        source: {
          id: sourceId,
          title,
          method: e.method,
          collected_at: e.generated_at,
          file: `data/external/${fName}`,
        },
        findings: loadOwner(e, sourceId, market),
      });
    } else console.log(`SKIP ${fName} (missing)`);
  }

  // ---------------------------------------------------- write sources + findings
  const allFindings = sources.flatMap((s) => s.findings);
  for (const s of sources) s.source.record_count = s.findings.length;

  await upsertBatched(
    "external_source",
    sources.map((s) => s.source),
    "id",
    "sources",
  );
  await upsertBatched("external_finding", allFindings, "id", "findings");
  await upsertBatched("search_trend", trendRows, "region,keyword,month", "search_trend");
  console.log(
    `upserted ${sources.length} sources, ${allFindings.length} findings, ${trendRows.length} search_trend rows`,
  );

  // ---------------------------------------------------- verify
  let failures = 0;
  console.log("source                     expected  actual  status");
  for (const s of sources) {
    const { count, error } = await supabase
      .from("external_finding")
      .select("*", { count: "exact", head: true })
      .eq("source_id", s.source.id);
    must(error, `count ${s.source.id}`);
    const ok = count === s.findings.length;
    if (!ok) failures++;
    console.log(
      `${s.source.id.padEnd(26)} ${String(s.findings.length).padStart(8)}  ${String(count).padStart(6)}  ${ok ? "OK" : "MISMATCH"}`,
    );
  }
  {
    const { count, error } = await supabase
      .from("search_trend")
      .select("*", { count: "exact", head: true });
    must(error, "count search_trend");
    const ok = count !== null && count >= trendRows.length;
    if (!ok) failures++;
    console.log(
      `${"search_trend (total)".padEnd(26)} ${String(trendRows.length).padStart(8)}  ${String(count).padStart(6)}  ${ok ? "OK" : "MISMATCH"}`,
    );
  }

  // ---------------------------------------------------- samples
  const sampleIds = allFindings.map((f) => f.id);
  const picks = [0, Math.floor(allFindings.length / 2), allFindings.length - 1]
    .filter((v, i, arr) => allFindings.length > 0 && arr.indexOf(v) === i)
    .map((i) => allFindings[i]);
  for (const p of picks) {
    const src = p.source_url ? p.source_url : `page ${p.source_page ?? "-"}`;
    console.log(`sample: ${p.id} | ${p.kind} | ${String(p.title).slice(0, 60)} | ${src}`);
  }

  if (failures > 0) {
    console.error(`${failures} MISMATCH(es)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
