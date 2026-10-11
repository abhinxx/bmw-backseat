"use client"

// "Create requirements": the PM picks which sources feed the run (BMW data is always on), optionally adds a CSV
// as context, and starts the pipeline. Re-running updates requirements in place; every change is logged.
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SparklesIcon } from "lucide-react"

import { CsvUpload } from "@/components/requirements/csv-upload"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { aiHeaders, readAi, readName, writeName } from "@/lib/client-settings"
import type { GenerateOptions, UploadedCsv } from "@/lib/requirements/types"

const STEPS = [
  "Reading BMW feedback, study, price lists and sales",
  "Grouping comments into 16 features",
  "Computing factors and scores (code, no AI)",
  "Drafting each requirement from its cited evidence",
  "Checking every citation, logging every change",
]

export function CreateRequirements({ vehicle, vehicleName, hasRequirements }: { vehicle: string; vehicleName: string; hasRequirements: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<GenerateOptions>({ public: true, research: true, whatif: vehicle === "G60" })
  const [csv, setCsv] = useState<UploadedCsv | null>(null)
  const [name, setName] = useState("")
  const [ownKey, setOwnKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function setDialogOpen(value: boolean) {
    if (busy) return
    if (value) { setName(readName()); setOwnKey(readAi()?.provider === "openai"); setError(null); setDone(null) }
    setOpen(value)
  }
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
  }, [])

  async function run() {
    setBusy(true)
    setError(null)
    setDone(null)
    setElapsed(0)
    writeName(name)
    const t0 = Date.now()
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500)
    try {
      const res = await fetch("/api/requirements/generate", {
        method: "POST",
        headers: { "content-type": "application/json", ...aiHeaders() },
        body: JSON.stringify({ vehicle, options: opts, csv, actor: name }),
      })
      const body = await res.json().catch(() => ({ error: `Server said ${res.status}` }))
      if (!res.ok) throw new Error(body.error ?? `Server said ${res.status}`)
      setDone(`${body.created} new, ${body.updated} updated, ${body.unchanged} unchanged · ${body.dropped_citations} invalid citation(s) dropped`)
      router.refresh()
      setTimeout(() => setOpen(false), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed")
    } finally {
      if (timer.current) clearInterval(timer.current)
      setBusy(false)
    }
  }

  // shortcut: this endpoint returns once complete; list stages, not invented live progress.
  const stages = STEPS.join(" → ")
  const check = ({ k, label, hint, disabled }: { k: keyof GenerateOptions; label: string; hint: string; disabled?: boolean }) => (
    <label className={`flex items-start gap-3 py-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={opts[k]}
        disabled={disabled || busy}
        onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )

  return (
    <>
      <Button size="lg" className="rounded-full px-5" onClick={() => setDialogOpen(true)}>
        <SparklesIcon className="size-4" />
        {hasRequirements ? "Update requirements" : "Create requirements"}
      </Button>
      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hasRequirements ? "Update" : "Create"} requirements · {vehicleName}</DialogTitle>
            <DialogDescription>
              Code finds the candidates and computes every score; the AI only writes the text, citing evidence. You decide.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y">
            <label className="flex items-start gap-3 py-2.5 opacity-80">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked disabled readOnly />
              <span>
                <span className="block text-sm font-medium">BMW internal data</span>
                <span className="block text-xs text-muted-foreground">Customer comments, customer study, price list, sales. Always on: the primary source.</span>
              </span>
            </label>
            {check({ k: "public", label: "Verified public data", hint: "Industry studies, rival tables and owner quotes from forums in the US, Europe and China." })}
            {check({ k: "research", label: "Research Agent findings", hint: "Past findings with verified quotes, matched to this feature and car line." })}
            {check({ k: "whatif", label: "What-If simulations",
              hint: vehicle === "G60" ? "Latest simulated segment reaction per feature. Lowest weight; simulated, not a customer vote." : "Customer segments exist for the 5 Series only.",
              disabled: vehicle !== "G60" })}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Add your own data (optional)</p>
            <CsvUpload value={csv} onChange={setCsv} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="req-actor">
              Your name
            </label>
            <Input id="req-actor" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anna Berger" />
            <p className="text-xs text-muted-foreground">
              Logged with the run as &ldquo;not signed in&rdquo;. AI key: {ownKey ? "your own (Settings)" : "team key"}.
            </p>
          </div>

          {busy && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">
                Running requirements pipeline… <span className="tabular-nums text-muted-foreground">{elapsed}s</span>
              </p>
              <p className="text-xs text-muted-foreground">{stages}. No live stage telemetry. Re-running updates existing requirements; your edits are kept.</p>
            </div>
          )}
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          {done && <p className="rounded-lg bg-observed/10 p-3 text-sm text-observed">Done: {done}</p>}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={run}>
              {busy ? "Running…" : hasRequirements ? "Update requirements" : "Create requirements"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
