"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { actorLabel, readName, writeName } from "@/lib/client-settings"

// Display name for the audit log. localStorage only — there is no login in this prototype.
export function NameForm() {
  const [name, setName] = useState("")
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    const n = readName()
    setName(n)
    setSaved(n)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name"
          maxLength={60}
          className="sm:max-w-xs"
          aria-label="Display name"
        />
        <Button
          onClick={() => {
            writeName(name)
            setSaved(readName())
          }}
        >
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Decisions in Requirements are logged with this name. There is no login, so it is labelled{" "}
        <span className="font-medium text-foreground">not signed in</span> in the audit trail.
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">Shown in the audit trail as: </span>
        <span className="font-medium">{actorLabel(saved ?? "")}</span>
      </p>
    </div>
  )
}
