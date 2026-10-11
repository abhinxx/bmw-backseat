"use client"

// Export/Download button in the What-If header. Polls /api/deck while a generation is in flight
// elsewhere; triggers the download once the deck is ready.
import { Download, FileText, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

type Status = "unknown" | "none" | "generating" | "ready" | "failed"

export function DeckButton({ runId }: { runId: string | null }) {
  const [status, setStatus] = useState<Status>("unknown")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const downloadFired = useRef(false)

  const ask = useCallback(async (): Promise<Status> => {
    const res = await fetch(`/api/deck?run=${runId}`).then((r) => r.json().catch(() => ({})))
    return (res.status as Status) ?? "none"
  }, [runId])

  useEffect(() => {
    if (!runId) return
    downloadFired.current = false
    setError(null)
    ask().then(setStatus).catch(() => setStatus("none"))
  }, [runId, ask])

  const fire = useCallback(() => {
    if (downloadFired.current) return
    downloadFired.current = true
    window.location.href = `/api/deck/file?run=${runId}`
  }, [runId])

  // While another request is generating, poll every 4 s; auto-download the moment it's ready.
  useEffect(() => {
    if (status !== "generating" || !runId) return
    const t = setInterval(async () => {
      const s = await ask().catch(() => "none" as Status)
      setStatus(s)
      if (s === "ready") fire()
    }, 4000)
    return () => clearInterval(t)
  }, [status, runId, ask, fire])

  if (!runId) return null

  if (status === "ready")
    return (
      <Button asChild size="lg" className="rounded-full px-5">
        <a href={`/api/deck/file?run=${runId}`}>
          <Download /> Download PDF
        </a>
      </Button>
    )

  const exportDeck = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.status === "ready") {
        setStatus("ready")
        fire()
      } else if (data.status === "generating") {
        setStatus("generating")
      } else {
        setStatus("failed")
        setError(data.error ?? "The deck could not be generated. Try again.")
      }
    } catch {
      setStatus("failed")
      setError("The deck could not be generated. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="lg" className="rounded-full px-5" onClick={exportDeck} disabled={busy || status === "generating"}>
        {busy || status === "generating" ? <Loader2 className="animate-spin" /> : <FileText />}
        {status === "generating" || busy ? "Writing the memo and drawing the cover, about 40 s" : "Export PDF"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
