import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import "./globals.css"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandMenu } from "@/components/command-menu"
import { ThemeProvider } from "@/components/theme-provider"
import { TopBar } from "@/components/top-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Backseat · BMW product intelligence",
  description: "Evidence-led requirements for the next BMW. The PM drives; the customers take the backseat.",
}

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <TopBar />
                <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</div>
              </SidebarInset>
              <CommandMenu />
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
