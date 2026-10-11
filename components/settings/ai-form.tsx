"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readAi, writeAi, type AiProvider, type AiSettings } from "@/lib/client-settings"

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic · not wired in this prototype" },
  { id: "google", label: "Google Gemini · not wired in this prototype" },
  { id: "azure-openai", label: "Azure OpenAI · not wired in this prototype" },
]

const DEFAULT_MODEL = "gpt-6-luna"

type Result = { ok: boolean; message: string } | null

// The PM's own OpenAI key, kept in localStorage and sent per request. Never stored server-side.
export function AiForm() {
  const [provider, setProvider] = useState<AiProvider>("openai")
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [key, setKey] = useState("")
  const [current, setCurrent] = useState<AiSettings | null>(null)
  const [result, setResult] = useState<Result>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ai = readAi()
    setCurrent(ai)
    if (ai) {
      setProvider(ai.provider)
      setModel(ai.model || DEFAULT_MODEL)
    }
  }, [])

  const save = () => {
    writeAi({ provider, model: model.trim() || DEFAULT_MODEL, key })
    setCurrent(readAi())
    setResult(null)
  }

  const remove = () => {
    writeAi(null)
    setCurrent(null)
    setKey("")
    setResult(null)
  }

  const test = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, key }),
      })
      const body = (await res.json()) as { ok?: boolean; message?: string }
      setResult({ ok: Boolean(body.ok), message: body.message ?? "Test failed." })
    } catch {
      setResult({ ok: false, message: "Could not reach the test endpoint." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {current?.key ? (
          <>
            Using <span className="font-medium">your own key</span>{" "}
            <span className="font-mono text-xs text-muted-foreground">sk-...{current.key.slice(-4)}</span>
          </>
        ) : (
          <>
            Using <span className="font-medium">the team key</span>
          </>
        )}
      </p>
      <div className="grid max-w-lg gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Model</span>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODEL} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">API key</span>
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={!key.trim()}>
          Save
        </Button>
        <Button variant="outline" onClick={test} disabled={busy || !key.trim()}>
          {busy ? "Testing…" : "Test key"}
        </Button>
        <Button variant="ghost" onClick={remove} disabled={!current?.key && !key}>
          Remove
        </Button>
      </div>
      {result && (
        <p className={result.ok ? "text-sm text-observed" : "text-sm text-destructive"}>{result.message}</p>
      )}
      <p className="max-w-2xl text-xs text-muted-foreground">
        Your key stays in this browser. It is sent with your Requirements runs and never stored on our server.
        What-If and Research use the team key in this prototype.
      </p>
    </div>
  )
}
