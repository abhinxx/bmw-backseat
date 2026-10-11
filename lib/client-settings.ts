// Browser-only settings (no login in the prototype): the PM's display name, their own AI key and the
// Codebeamer connection. Stored in localStorage only; never written to the database.
// Shared by Settings, Requirements (decisions are logged with this name) and the exports.

export const LS_KEYS = {
  name: "backseat.pm_name",
  ai: "backseat.ai",
} as const

export type AiProvider = "openai" | "anthropic" | "google" | "azure-openai"

export type AiSettings = {
  provider: AiProvider
  model: string
  key: string
}

const hasWindow = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined"

export function readName(): string {
  if (!hasWindow()) return ""
  return window.localStorage.getItem(LS_KEYS.name) ?? ""
}

export function writeName(name: string) {
  if (!hasWindow()) return
  const n = name.trim().slice(0, 60)
  if (n) window.localStorage.setItem(LS_KEYS.name, n)
  else window.localStorage.removeItem(LS_KEYS.name)
}

/** How a person shows up in the audit log without a login. */
export function actorLabel(name: string): string {
  const n = name.trim()
  return n ? `${n} (not signed in)` : "Anonymous PM (not signed in)"
}

export function readAi(): AiSettings | null {
  if (!hasWindow()) return null
  try {
    const raw = window.localStorage.getItem(LS_KEYS.ai)
    if (!raw) return null
    const v = JSON.parse(raw) as AiSettings
    return v && typeof v.key === "string" && v.key ? v : null
  } catch {
    return null
  }
}

export function writeAi(v: AiSettings | null) {
  if (!hasWindow()) return
  if (!v || !v.key.trim()) window.localStorage.removeItem(LS_KEYS.ai)
  else window.localStorage.setItem(LS_KEYS.ai, JSON.stringify({ ...v, key: v.key.trim() }))
}

/** Headers for API calls that run the AI. Only an OpenAI key is wired in the prototype. */
export function aiHeaders(): Record<string, string> {
  const ai = readAi()
  if (!ai || ai.provider !== "openai") return {}
  return { "x-openai-key": ai.key, ...(ai.model ? { "x-openai-model": ai.model } : {}) }
}
