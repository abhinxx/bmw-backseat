import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Requirement } from "@/lib/requirements/types"

const req: Requirement = {
  id: "11111111-1111-4111-8111-111111111111", code: "REQ-G60-CTRL-FIX", vehicle: "G60", feature_id: "controls", kind: "fix",
  title: "Climate controls without touchscreen menus", description: "The driver adjusts temperature directly.", target: "Proposed target: 75% satisfaction",
  rationale: "Owners ask for direct controls [G60-0001].", assumptions: ["Physical controls still matter in 2030."], uncertainties: ["No sample sizes."], conflicts: ["Some owners prefer screens."],
  markets: ["US", "EU"], score: 71, priority: "P1", priority_override: null, rank: 1, evidence_level: "A",
  factors: [{ id: "customer_voice", label: "Customer voice", value: 0.71, weight: 30, included: true, detail: "216 complaints", source: "feedback_comment, feedback_label" }],
  sources: [{ id: "G60-0001", kind: "comment", label: "BMW customer", text: "Bring back buttons", href: "/evidence/comment/G60-0001", role: "supports" }],
  status: "proposed", status_reason: null, edited_by_pm: false, run_id: null, version: 1, created_at: "2026-10-11T08:30:00Z", updated_at: "2026-10-11T08:30:00Z",
}

// The database read is the only substitute: rendering and composed UI use real components.
test("requirement detail renders priority factors, evidence, assumptions and PM review", async () => {
  assert.ok(existsSync("app/requirements/[code]/page.tsx"), "Requirement detail route is missing")
  const previous = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes("/rest/v1/requirement_event")) return Response.json([])
    if (url.includes("/rest/v1/requirement?")) return Response.json(req)
    throw new Error(`Unexpected request: ${url}`)
  }
  try {
    const { default: Page } = await import("@/app/requirements/[code]/page")
    const tree = await Page({ params: Promise.resolve({ code: req.code }), searchParams: Promise.resolve({ v: "G60", m: "all" }) })
    const router = { bfcacheId: "test-route", back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {}, hmrRefresh() {} }
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(TooltipProvider, null, tree)))
    for (const text of [req.title, "Customer voice", "216 complaints", "Supports", "Bring back buttons", "Assumptions", "Uncertainties", "Audit trail", "Approve", "Reject", "Challenge with AI"])
      assert.ok(html.includes(text), `Missing ${text}`)
    assert.ok(html.includes("forward-looking"), "Target must be labelled an assumption")
    assert.ok(html.includes("feedback_comment"), "Source tables must be visible")
  } finally { globalThis.fetch = previous }
})

test("Settings and Workflow are reachable from shared navigation", async () => {
  const { NAV } = await import("@/lib/nav")
  assert.ok(NAV.some((item) => String(item.href) === "/settings"), "Settings is orphaned")
  assert.ok(NAV.some((item) => String(item.href) === "/workflow"), "Workflow is orphaned")
})

test("Requirements market picker filters rows instead of showing US evidence under China", async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes("/rest/v1/requirement?")) return Response.json([req])
    if (url.includes("/rest/v1/requirement_run")) return Response.json([])
    if (url.includes("/rest/v1/rpc/feedback_coverage")) return Response.json([{ country: "US", comments: 10 }])
    throw new Error(`Unexpected request: ${url}`)
  }
  try {
    const { default: Page } = await import("@/app/requirements/page")
    const tree = await Page({ searchParams: Promise.resolve({ v: "G60", m: "CN" }) })
    const router = { bfcacheId: "test", back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(TooltipProvider, null, tree)))
    assert.ok(!html.includes(req.title), "Requirement without China signal must not appear in China view")
    assert.ok(html.includes("China"), "Selected market must be visible")
  } finally { globalThis.fetch = previous }
})

test("open requirement counts exclude decisions and honor the market picker", async () => {
  const ui = await import("@/lib/requirements/ui")
  assert.ok("openRequirementCount" in ui, "Open requirements counter is missing")
  const count = (ui as typeof ui & { openRequirementCount: (rows: Requirement[], market: string) => number }).openRequirementCount
  const rows = [req, { ...req, status: "approved" as const }, { ...req, status: "in_review" as const, markets: ["CN"] }]
  assert.equal(count(rows, "all"), 2)
  assert.equal(count(rows, "CN"), 1)
  assert.equal(count(rows, "EU"), 1)
})
