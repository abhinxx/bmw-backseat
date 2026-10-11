"use client"

import { Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { navFor } from "@/lib/nav"
import { MARKETS, VEHICLES, marketOf, vehicleOf } from "@/lib/scope"

export const OPEN_COMMAND_EVENT = "backseat:open-command"

function ScopePickers() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const vehicle = vehicleOf(params.get("v"))
  const market = marketOf(params.get("m"))

  const set = (key: "v" | "m", value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <>
      <Select value={vehicle.id} onValueChange={(v) => set("v", v)}>
        <SelectTrigger size="sm" className="w-[150px]" aria-label="Vehicle">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VEHICLES.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name} <span className="text-muted-foreground">{v.id}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={market.id} onValueChange={(m) => set("m", m)}>
        <SelectTrigger size="sm" className="w-[140px]" aria-label="Market">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MARKETS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle light or dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}

export function TopBar() {
  const title = navFor(usePathname()).title
  return (
    <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-xl backdrop-saturate-150">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <span className="text-sm font-medium">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        <Suspense fallback={null}>
          <ScopePickers />
        </Suspense>
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:inline-flex"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))}
        >
          <Search />
          Search
          <Kbd>⌘K</Kbd>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  )
}
