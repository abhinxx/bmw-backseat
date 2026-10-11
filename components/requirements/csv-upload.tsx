"use client"

// Upload the PM's own CSV as AI context for one generation run. Context only: the rows are
// labelled unverified, never loaded into BMW tables and never counted in scores (config SOURCE_HIERARCHY tier 5).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toUploadedCsv } from "@/lib/requirements/csv"
import type { UploadedCsv } from "@/lib/requirements/types"

export function CsvUpload({
  value,
  onChange,
}: {
  value: UploadedCsv | null
  onChange: (v: UploadedCsv | null) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ textColumn: string; warnings: string[] } | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setMeta(null)
    const text = await file.text()
    const result = toUploadedCsv(file.name, text, file.size)
    if ("error" in result) {
      setError(result.error)
      return
    }
    setMeta({ textColumn: result.textColumn, warnings: result.warnings })
    onChange(result.csv)
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50">
        <span>Drop a CSV or click to choose</span>
        <span className="text-xs">Customer feedback export, up to 500 KB</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ""
          }}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {value && meta && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">{value.name}</div>
              <div className="text-xs text-muted-foreground">
                {value.rows.length} rows · text column “{meta.textColumn}”
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMeta(null)
                onChange(null)
              }}
            >
              Remove
            </Button>
          </div>
          {meta.warnings.map((w) => (
            <p key={w} className="text-xs text-destructive">
              {w}
            </p>
          ))}
          <ul className="space-y-1">
            {value.rows.slice(0, 3).map((r) => (
              <li key={r.id} className="line-clamp-2 text-xs text-muted-foreground">
                <span className="font-medium">{r.id}:</span> {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Sent to the AI as context for this run only. Not loaded into BMW data, never counted in
        scores, labelled unverified.
      </p>
    </div>
  )
}
