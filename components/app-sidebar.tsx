"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NAV, navFor } from "@/lib/nav"
import { scopeQuery } from "@/lib/scope"

function NavItems({ query }: { query: string }) {
  const active = navFor(usePathname()).href
  return (
    <SidebarMenu>
      {NAV.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={item.href === active} tooltip={item.title}>
            <Link href={item.href + query}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function ScopedNavItems() {
  return <NavItems query={scopeQuery(useSearchParams())} />
}

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  B
                </span>
                <span className="grid leading-tight">
                  <span className="font-semibold">Backseat</span>
                  <span className="text-xs text-muted-foreground">BMW product intelligence</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Suspense fallback={<NavItems query="" />}>
              <ScopedNavItems />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          The PM drives. The customers take the backseat.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
