// Pure CSV parsing for the PM's uploaded feedback file. No React, no File API here:
// components/requirements/csv-upload.tsx reads the File and hands us name/text/bytes.
import { LIMITS } from "@/lib/requirements/config"
import type { UploadedCsv } from "@/lib/requirements/types"

/**
 * RFC 4180-ish CSV parser: strips a UTF-8 BOM, honours "quoted fields" with ""-escaped quotes,
 * commas and newlines inside quotes, CRLF or LF, and drops a trailing empty line.
 * Auto-detects ';' as the delimiter when the header line has more ';' than ','.
 */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const firstLineEnd = text.search(/\r?\n/)
  const headerLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)
  const count = (s: string, ch: string) => s.split(ch).length - 1
  const delim = count(headerLine, ";") > count(headerLine, ",") ? ";" : ","

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0
  const pushField = () => {
    row.push(field)
    field = ""
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delim) {
      pushField()
      i++
      continue
    }
    if (ch === "\r" || ch === "\n") {
      // CRLF is one line break; a lone CR is also treated as a break.
      if (ch === "\r" && text[i + 1] === "\n") i++
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }
  // Only flush the last field/row if there is actual content after the final line break.
  if (field !== "" || row.length > 0) pushRow()

  // Trailing empty line(s), e.g. from a final CRLF, are not data.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop()
  return rows
}

const TEXT_COLUMN_RE = /comment|feedback|text|verbatim|review|quote/i

export type CsvParseResult =
  | { csv: UploadedCsv; textColumn: string; warnings: string[] }
  | { error: string }

/**
 * Turn an uploaded CSV into the UploadedCsv context the AI sees: pick the text column,
 * drop empty rows, cap rows and row length. Labelled unverified downstream; never BMW data.
 */
export function toUploadedCsv(
  name: string,
  text: string,
  bytes: number
): CsvParseResult {
  if (bytes > LIMITS.csvMaxBytes) return { error: "File is larger than 500 KB." }
  const nonEmptyLineCount = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "").length
  if (nonEmptyLineCount < 2) return { error: "The file has no data rows." }

  const grid = parseCsv(text)
  if (grid.length < 2) return { error: "The file has no data rows." }
  const header = grid[0].map((h) => h.trim())
  const body = grid.slice(1)

  // Text column: first header that looks like feedback text, else the column with the
  // longest average cell.
  let textIdx = header.findIndex((h) => TEXT_COLUMN_RE.test(h))
  if (textIdx === -1) {
    let best = -1
    let bestAvg = 0
    for (let c = 0; c < header.length; c++) {
      let sum = 0
      for (const row of body) sum += (row[c] ?? "").length
      const avg = body.length ? sum / body.length : 0
      if (avg > bestAvg) {
        bestAvg = avg
        best = c
      }
    }
    textIdx = best
  }
  if (textIdx === -1) return { error: `No row has text in column '${header[0] ?? ""}'.` }
  const textColumn = header[textIdx] ?? header[0]

  const warnings: string[] = []
  let usable = body
    .map((row) => ({
      text: (row[textIdx] ?? "").trim().slice(0, 1000),
      extra: Object.fromEntries(
        header
          .map((h, c) => [h, c] as const)
          .filter(([h, c]) => c !== textIdx && h !== "")
          .map(([h, c]) => [h, (row[c] ?? "").trim()] as const)
      ),
    }))
    .filter((r) => r.text !== "")
  if (usable.length > LIMITS.csvMaxRows) {
    usable = usable.slice(0, LIMITS.csvMaxRows)
    warnings.push(`Only the first ${LIMITS.csvMaxRows} rows are used.`)
  }
  if (usable.length === 0) return { error: `No row has text in column '${textColumn}'.` }

  const csv: UploadedCsv = {
    name,
    rows: usable.map((r, i) => ({ id: `CSV-${i + 1}`, text: r.text, extra: r.extra })),
  }
  return { csv, textColumn, warnings }
}
