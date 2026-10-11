"use client"

// The Export button on the Requirements pages: CSV / JSON download (local Blob, nothing sent)
// and the "Export to Codebeamer…" dialog (preview only until the integration is connected).
import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CodebeamerDialog } from "@/components/requirements/codebeamer-dialog"
import { toCsv, toJson } from "@/lib/requirements/export"
import type { Requirement } from "@/lib/requirements/types"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Download through an in-memory Blob and a temporary <a download>; revoke the URL afterwards. */
function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ExportMenu({
  requirements,
  vehicle,
}: {
  requirements: Requirement[]
  vehicle: string
}) {
  const [cbOpen, setCbOpen] = useState(false)
  const empty = requirements.length === 0
  const base = `backseat-requirements-${vehicle}-${today()}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <DownloadIcon />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={empty}
            onSelect={() => download(`${base}.csv`, toCsv(requirements), "text/csv;charset=utf-8")}
          >
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={empty}
            onSelect={() =>
              download(`${base}.json`, toJson(requirements), "application/json")
            }
          >
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCbOpen(true)}>
            Export to Codebeamer…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CodebeamerDialog open={cbOpen} onOpenChange={setCbOpen} requirements={requirements} />
    </>
  )
}
