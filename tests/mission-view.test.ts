import assert from "node:assert/strict"
import test from "node:test"
import { rankTopics, scopeSnapshot } from "../lib/mission-view"

const snapshot = {
  sales2025: { EU: 100, US: 60, CN: 50, RoW: 10 },
  sales2030: { EU: 120, US: 65, CN: 70, RoW: 12 },
  feedbackBy: { EU: 3, US: 90, CN: 0, RoW: 7 },
  satisfaction: [{ market: "EU" as const, value: 8.3, cell: "EU!B2" }, { market: "CN" as const, value: 8.8, cell: "CN!C2" }],
}

test("US scope never substitutes European satisfaction for a missing US study", () => {
  const view = scopeSnapshot(snapshot, "US")
  assert.equal(view.comments, 90)
  assert.equal(view.sales, 60)
  assert.deepEqual(view.satisfaction, [])
})

test("Problems ranks negative comments, not praise-heavy total mentions", () => {
  const ranked = rankTopics([
    { level2: "Drivetrain", sentiment: "positive", comments: 400 },
    { level2: "Drivetrain", sentiment: "negative", comments: 3 },
    { level2: "Touch screen, operation", sentiment: "negative", comments: 20 },
    { level2: "Seats", sentiment: "want", comments: 30 },
  ], "negative")
  assert.deepEqual(ranked.map((r) => [r.level2, r.comments]), [["Touch screen, operation", 20], ["Drivetrain", 3]])
})
