"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { aiHeaders, readName, writeName } from "@/lib/client-settings"
import { LIMITS, STATUS_LABEL } from "@/lib/requirements/config"
import type { Priority, Requirement, ReqStatus } from "@/lib/requirements/types"

type Mode = { type: "status"; status: ReqStatus } | { type: "edit" | "priority" | "challenge" }

export function RequirementActions({ requirement: req }: { requirement: Requirement }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [fields, setFields] = useState({ title: req.title, description: req.description, target: req.target ?? "" })
  const [priority, setPriority] = useState<Priority | "auto">(req.priority_override ?? "auto")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setName(readName()) }, [])

  function open(next: Mode) {
    setMode(next)
    setReason("")
    setError(null)
    setMessage(null)
    setName(readName())
    setFields({ title: req.title, description: req.description, target: req.target ?? "" })
    setPriority(req.priority_override ?? "auto")
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode || reason.trim().length < LIMITS.reasonMinChars || busy) return
    setBusy(true)
    setError(null)
    writeName(name)
    try {
      const res = await fetch(`/api/requirements/${req.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(mode.type === "challenge" ? aiHeaders() : {}) },
        body: JSON.stringify({ ...mode, reason, actor: name, version: req.version,
          ...(mode.type === "edit" ? { fields } : {}),
          ...(mode.type === "priority" ? { priority: priority === "auto" ? null : priority } : {}),
        }),
      })
      const result = await res.json().catch(() => ({ error: `Server said ${res.status}` }))
      if (!res.ok) throw new Error(result.error ?? "Action failed")
      setMessage(mode.type === "challenge" ? `AI challenge: ${String(result.verdict).replace(/_/g, " ")}. ${result.summary}` : "Decision saved. The audit trail records who, what changed and why.")
      setMode(null)
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed") }
    finally { setBusy(false) }
  }

  const title = mode?.type === "status" ? `Set status: ${STATUS_LABEL[mode.status]}` : mode?.type === "edit" ? "Edit requirement" : mode?.type === "priority" ? "Override priority" : "Challenge with AI"
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="PM review">
      <div>
        <h2 className="text-base font-semibold">Your decision</h2>
        <p className="mt-1 text-xs text-muted-foreground">Every action needs a reason. Shared prototype: display names are not authenticated identities.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={req.status === "approved"} onClick={() => open({ type: "status", status: "approved" })}>Approve</Button>
        <Button variant="outline" disabled={req.status === "rejected"} onClick={() => open({ type: "status", status: "rejected" })}>Reject</Button>
        <Button variant="outline" disabled={req.status === "in_review"} onClick={() => open({ type: "status", status: "in_review" })}>In review</Button>
        <Button variant="outline" disabled={req.status === "postponed"} onClick={() => open({ type: "status", status: "postponed" })}>Postpone</Button>
        {req.status !== "proposed" && <Button variant="ghost" onClick={() => open({ type: "status", status: "proposed" })}>Reopen proposal</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => open({ type: "edit" })}>Edit requirement</Button>
        <Button variant="ghost" onClick={() => open({ type: "priority" })}>Override priority</Button>
        <Button variant="ghost" onClick={() => open({ type: "challenge" })}>Challenge with AI</Button>
      </div>
      <p className="text-xs text-muted-foreground">Challenge re-examines the saved evidence for counter-arguments. It does not search the web or change your decision.</p>
      {message && <p role="status" className="text-sm">{message}</p>}
      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open && !busy) setMode(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{mode?.type === "edit" ? "Your edited text is protected from later AI redrafts." : mode?.type === "challenge" ? "The AI looks for counter-evidence in this requirement's saved sources. Your status stays unchanged." : "The calculated score stays unchanged. Your decision and reason are recorded."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {mode?.type === "edit" && <div className="space-y-3">
              <label className="block space-y-1 text-sm">Title<Input value={fields.title} maxLength={140} required disabled={busy} onChange={(e) => setFields({ ...fields, title: e.target.value })} /></label>
              <label className="block space-y-1 text-sm">Customer-facing description<Textarea value={fields.description} maxLength={1200} required disabled={busy} onChange={(e) => setFields({ ...fields, description: e.target.value })} /></label>
              <label className="block space-y-1 text-sm">Measurable target (forward-looking assumption)<Textarea value={fields.target} maxLength={1200} disabled={busy} onChange={(e) => setFields({ ...fields, target: e.target.value })} /></label>
            </div>}
            {mode?.type === "priority" && <label className="block space-y-1 text-sm">Priority
              <select className="block h-9 w-full rounded-md border bg-background px-3" value={priority} disabled={busy} onChange={(e) => setPriority(e.target.value as Priority | "auto")}>
                <option value="auto">Use calculated priority ({req.priority})</option><option value="P1">P1 - must have</option><option value="P2">P2 - should have</option><option value="P3">P3 - could have</option>
              </select>
            </label>}
            <label className="block space-y-1 text-sm">Your name<Input value={name} maxLength={60} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="Anonymous PM if left blank" /></label>
            <label className="block space-y-1 text-sm">Reason (required)<Textarea value={reason} maxLength={1000} required disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder="Why are you making this decision?" /></label>
            <p className="text-xs text-muted-foreground">At least {LIMITS.reasonMinChars} characters. Logged as {name.trim() || "Anonymous PM"} (not signed in).</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
              <Button type="submit" disabled={busy || reason.trim().length < LIMITS.reasonMinChars}>{busy ? "Saving…" : mode?.type === "challenge" ? "Run challenge" : "Save decision"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
