"use client"

// "Export to Codebeamer" dialog. Deliberately NOT connected: the Send button only shows what
// would be sent (a real PTC Codebeamer v3 tracker-item body per requirement) and where it would
// go. Nothing leaves the tool until Settings → Integrations is configured, and human review
// (approved only) is the default gate.
import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CODEBEAMER_ENDPOINT, toCodebeamerItem } from "@/lib/requirements/export"
import type { Requirement } from "@/lib/requirements/types"

export function CodebeamerDialog({
  open,
  onOpenChange,
  requirements,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  requirements: Requirement[]
}) {
  const [approvedOnly, setApprovedOnly] = useState(true)
  const [previewCode, setPreviewCode] = useState<string>("")
  const [showAlert, setShowAlert] = useState(false)

  const items = useMemo(
    () => (approvedOnly ? requirements.filter((r) => r.status === "approved") : requirements),
    [requirements, approvedOnly]
  )
  const selected = items.find((r) => r.code === previewCode) ?? items[0] ?? null


  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) setShowAlert(false); onOpenChange(value) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to Codebeamer</DialogTitle>
          <DialogDescription>
            One tracker item per requirement, via the PTC Codebeamer REST API v3.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={approvedOnly}
              onChange={(e) => setApprovedOnly(e.target.checked)}
            />
            Approved only
          </label>
          <p className="text-xs text-muted-foreground">
            Payload preview defaults to approved requirements. Nothing is sent, regardless of status.
          </p>

          <div className="space-y-1">
            <div className="text-sm font-medium">{items.length} items · tracker-specific fields are not mapped</div>
            <div className="text-xs text-muted-foreground">{CODEBEAMER_ENDPOINT}</div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved requirements yet. Approve one first, or untick &lsquo;Approved only&rsquo;.
            </p>
          ) : (
            <div className="space-y-2">
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={selected?.code ?? ""}
                onChange={(e) => setPreviewCode(e.target.value)}
              >
                {items.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code} — {r.title}
                  </option>
                ))}
              </select>
              {selected && (
                <pre className="max-h-72 max-w-full min-w-0 overflow-auto rounded-lg bg-muted p-3 text-xs break-words whitespace-pre-wrap">
                  {JSON.stringify(toCodebeamerItem(selected), null, 2)}
                </pre>
              )}
            </div>
          )}

          {showAlert && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="font-medium">Codebeamer is not connected.</div>
              <div className="mt-1 text-muted-foreground">
                A real connection requires your Codebeamer URL, tracker ID and API token. Connection is disabled in this prototype; see Settings → Integrations.
                Nothing was sent.
              </div>
              <Link className="mt-2 inline-block text-primary underline-offset-4 hover:underline" href="/settings#integrations">
                Open Settings
              </Link>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={items.length === 0} onClick={() => setShowAlert(true)}>
            Send {items.length} items to Codebeamer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
