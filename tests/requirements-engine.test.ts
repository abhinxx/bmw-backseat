import assert from "node:assert/strict"
import test from "node:test"
import type { Requirement } from "@/lib/requirements/types"

const req: Requirement = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "REQ-G60-CTRL-FIX",
  vehicle: "G60",
  feature_id: "controls",
  kind: "fix",
  title: "Climate controls without touchscreen menus",
  description: "The driver adjusts temperature directly.",
  target: "Proposed target: 75% satisfaction",
  rationale: "Owners ask for direct controls [G60-0001].",
  assumptions: ["Physical controls still matter in 2030."],
  uncertainties: ["No sample sizes."],
  conflicts: ["Some owners prefer screens."],
  markets: ["US", "EU"],
  score: 71,
  priority: "P1",
  priority_override: null,
  rank: 1,
  evidence_level: "A",
  factors: [
    {
      id: "customer_voice",
      label: "Customer voice",
      value: 0.71,
      weight: 30,
      included: true,
      detail: "216 complaints",
      source: "feedback_comment, feedback_label",
    },
  ],
  sources: [
    {
      id: "G60-0001",
      kind: "comment",
      label: "BMW customer",
      text: "Bring back buttons",
      href: "/evidence/comment/G60-0001",
      role: "supports",
    },
  ],
  status: "proposed",
  status_reason: null,
  edited_by_pm: false,
  run_id: null,
  version: 1,
  created_at: "2026-10-11T08:30:00Z",
  updated_at: "2026-10-11T08:30:00Z",
}

// JSONB changes object-key order but not meaning. Reruns must not invent changes.
test("stored JSONB key order does not change requirement equality", async () => {
  const engine = await import("@/lib/requirements/engine")
  assert.ok("same" in engine, "Canonical equality is not exposed")
  const same = (
    engine as typeof engine & { same: (a: unknown, b: unknown) => boolean }
  ).same
  assert.equal(
    same(
      [{ id: "voice", value: 0.5, weight: 30 }],
      [{ weight: 30, value: 0.5, id: "voice" }]
    ),
    true
  )
  assert.equal(same({ score: 40 }, { score: 41 }), false)
  assert.equal(same(null, undefined), true)
})

test("public-off excludes rival evidence as well as its scoring factor", async () => {
  const { FEATURES } = await import("@/lib/features")
  const { DEFAULT_WEIGHTS } = await import("@/lib/requirements/config")
  const { buildCandidates } = await import("@/lib/requirements/signals")
  const zero = () => ({ EU: 0, US: 0, CN: 0, RoW: 0 })
  const counts = new Map(
    FEATURES.map((f) => [
      f.id,
      {
        positive: 0,
        negative: f.id === "rear_comfort" ? 20 : 0,
        want: 0,
        byBucket: {
          positive: zero(),
          negative: { ...zero(), US: f.id === "rear_comfort" ? 20 : 0 },
          want: zero(),
        },
      },
    ])
  )
  const sig = {
    vehicle: "G60",
    totalComments: 100,
    countries: ["US"],
    salesShare: { EU: 0.5, US: 0.5, CN: 0, RoW: 0 },
    counts,
    study: [],
    resRows: [],
    simRows: [],
    extRows: [
      {
        id: "rival1",
        source_id: "rivals",
        kind: "competitor_feature",
        vehicle: "G60",
        topic: "rear_seat_heating",
        subject: "E-Class",
        title: "Standard",
        stance: null,
        quote: null,
        source_url: null,
        raw: {},
      },
    ],
  }
  const candidate = buildCandidates(
    sig,
    { public: false, research: false, whatif: false },
    DEFAULT_WEIGHTS
  )[0]
  assert.equal(
    candidate.rivals.length,
    0,
    "Public-off leaked competitor rows to drafting"
  )
  assert.equal(
    candidate.factors.find((f) => f.id === "competitor")?.included,
    false
  )
})

test("CSV export treats formula-shaped text as literal spreadsheet cells", async () => {
  const { toCsv } = await import("@/lib/requirements/export")
  const { parseCsv } = await import("@/lib/requirements/csv")
  const reqs = [req]
  for (const title of [
    '=HYPERLINK("https://example.invalid")',
    "+1+1",
    "-2+3",
    "@SUM(1)",
    "\t=1+1",
    " =1+1",
  ]) {
    const grid = parseCsv(toCsv([{ ...reqs[0], title }]))
    assert.equal(grid[1][grid[0].indexOf("title")], "'" + title)
  }
})

test("an audit write failure cannot leave a PM decision persisted", async () => {
  const { pmAction } = await import("@/lib/requirements/engine")
  const original = globalThis.fetch
  let nonAtomicWrite = false
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes("/rest/v1/requirement?") && init?.method === "GET")
      return Response.json(req)
    if (url.includes("/rest/v1/requirement?") && init?.method === "PATCH") {
      nonAtomicWrite = true
      return Response.json(null)
    }
    if (
      url.includes("requirement_event") ||
      url.includes("/rpc/save_requirement_change")
    )
      return Response.json({ message: "Audit unavailable" }, { status: 400 })
    throw new Error(`Unexpected request ${init?.method} ${url}`)
  }
  try {
    await assert.rejects(
      () =>
        pmAction(
          req.id,
          { type: "status", status: "approved", reason: "Strong evidence" },
          "Test PM"
        ),
      /Audit unavailable/
    )
    assert.equal(
      nonAtomicWrite,
      false,
      "Decision was persisted before its audit event failed"
    )
  } finally {
    globalThis.fetch = original
  }
})

test("AI challenge requires a reason before any paid call or database access", async () => {
  const { POST } = await import("@/app/api/requirements/[id]/route")
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("Unexpected network access")
  }
  try {
    const res = await POST(
      new Request("https://test.invalid", {
        method: "POST",
        body: JSON.stringify({ type: "challenge", reason: "" }),
      }),
      { params: Promise.resolve({ id: req.id }) }
    )
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, /reason/i)
  } finally {
    globalThis.fetch = original
  }
})

test("generation rejects unknown vehicles and malformed CSV rows before network access", async () => {
  const { POST } = await import("@/app/api/requirements/generate/route")
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("Unexpected network access")
  }
  try {
    for (const body of [
      { vehicle: "typo" },
      { vehicle: "G60", csv: { name: "bad.csv", rows: [null] } },
      { vehicle: "G60", options: { public: "false" } },
    ]) {
      const res = await POST(
        new Request("https://test.invalid", {
          method: "POST",
          body: JSON.stringify(body),
        })
      )
      assert.equal(
        res.status,
        400,
        `Invalid generation input accepted: ${JSON.stringify(body)}`
      )
    }
  } finally {
    globalThis.fetch = original
  }
})

test("the own-key validation endpoint throttles repeated requests", async () => {
  const { POST } = await import("@/app/api/settings/test-key/route")
  let response: Response | undefined
  for (let i = 0; i < 31; i++)
    response = await POST(
      new Request("https://test.invalid", {
        method: "POST",
        body: JSON.stringify({ provider: "unsupported" }),
      })
    )
  assert.equal(response?.status, 429)
})
