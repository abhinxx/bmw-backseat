"use client"

import { Car, FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { OPEN_COMMAND_EVENT } from "@/components/top-bar"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { NAV, SUGGESTED_WHAT_IFS } from "@/lib/nav"
import { VEHICLES } from "@/lib/scope"

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen)
    }
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search Backseat">
      <CommandInput placeholder="Jump to a screen, a vehicle or start a what-if…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV.map((n) => (
            <CommandItem key={n.href} onSelect={() => go(n.href)}>
              <n.icon />
              {n.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Vehicle">
          {VEHICLES.map((v) => (
            <CommandItem key={v.id} onSelect={() => go(`/?v=${v.id}`)}>
              <Car />
              {v.name}
              <span className="text-muted-foreground">{v.id}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Try a what-if">
          {SUGGESTED_WHAT_IFS.map((q) => (
            <CommandItem key={q} onSelect={() => go(`/what-if?q=${encodeURIComponent(q)}`)}>
              <FlaskConical />
              {q}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
