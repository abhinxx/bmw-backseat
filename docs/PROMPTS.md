# What-If prompts: v2 → v3 audit and A/B

## Purpose

The What-If engine parses a product manager's question into a structured change (`parseChange`), gathers fixed per-persona×feature evidence, and asks the model to simulate how each of 9 customer segments reacts (`react`). Only prompt text, the evidence formatting inside `react`, `personaBrief`'s wording, schema `description` fields, and `PROMPT_VERSION` were changed. All grounding machinery (evidence selection, citation filtering, confidence cap, cache, verdict enum) is untouched. Baseline: `whatif-v2` @ model `gpt-6-luna`. Final version: **`whatif-v3.1`** (v3 + one rubric revision).

## Audit findings (14 stored runs, 108 verdicts, anon-key read 2026-10-11)

1. **`slightly_*` as escape hatch.** 35/108 called verdicts (32%) were slightly_*; in run `25edcfdf` (Q1, luna v2) 6/9 personas landed on `slightly_more_likely` — the panel hedges instead of splitting.
2. **`not_enough_evidence` despite usable evidence.** Run `1713be14` (Q2) EU-2: one comment wanting rear climate + HVAC study mean + price-list item → NEE; AS-3: 7 comments (2 wants) → NEE. Run `8172bf10` ("glass roof standard"): 8/9 NEE. The model treated "no comment about this exact feature" as zero evidence and ignored the totals line and study means; 38 of 108 called verdicts were NEE.
3. **`supporting_ids` used as "related evidence", not "evidence for the verdict".** 11 `no_effect` verdicts carried 2-3 supporting_ids; `25edcfdf` AM-2 (no_effect) cited 3 comments that *ask* for simpler controls as supporting; `80381a7c` AS-3 (slightly_less_likely) cited positive comments as supporting.
4. **Reasons hedging instead of naming deciders.** "does not establish whether this segment values X" verbatim-style across `1713be14` EU-1/EU-2/EU-3/AS-2; `25edcfdf` AM-1 reason names no IDs while its fields carry 10. Only 34/108 reasons mentioned any evidence ID.
5. **Citation tokens leaking into prose.** `25edcfdf` AM-3 reaction ends "[G60-0190] [G60-0271]"; reactions drift to analyst voice.
6. **Generic assumptions.** `25edcfdf` AM-1/AM-3: "The proposed simplification improves usability without reducing valued functionality" = restating the change; 44 verdicts carried zero assumptions. No definition of high/medium/low confidence → 68/108 verdicts collapsed to `low`.
7. **parseChange.** `8172bf10` "Make a glass roof standard" → feature `price_value` (glass roof is not one of the 16; null was the honest answer); `4e122fdf` "Driver assistance" (no change stated) still burned 9 calls. No change_type definitions existed (v2 stored it silently from an enum list).
8. (v1 relic, mostly fixed in v2 but kept as rule:) invented family/weather details in reactions — `2c56e247` AM-2/AM-3.

## Old prompts (v2, verbatim)

`parseChange` system:

> You turn a BMW product manager's what-if question about the next ${vehicleName} into a structured change. Pick the ONE feature from the list that the change is mainly about, or null if none fits. Do not invent features.
>
> Features:
> \- <id>: <name>. <description>   (×16)

`react` system:

> You simulate how ONE evidence-based customer segment of the BMW ${vehicleName} would react to a proposed change for the successor model (about 2030). You are not a real customer and this is not a vote. Use ONLY the evidence below; every item has an ID in square brackets.
> Rules:
> \- Cite the IDs that support the verdict (supporting_ids) and that argue against it (opposing_ids). Only IDs from the evidence.
> \- If the evidence does not speak to this change for this segment, answer not_enough_evidence. That is a good answer.
> \- Never invent numbers, prices, or quotes. Keep the reaction to 1-2 sentences in the segment's voice, and the reason to 1 sentence in an analyst's voice.
> \- The reaction may only refer to things in the segment description or in the evidence. Do not mention family, children, competitors, weather or anything else unless an evidence item says so.
> \- Weigh what this segment cares about (its cluster and stats). A change it does not care about is no_effect, even if it is nice.
> \- assumptions: forward-looking assumptions your verdict depends on (max 2).
>
> {personaBrief}

`personaBrief` (v2): `Segment/Market/Cohort` line, `Behavioural cluster: <name>; key stats: {raw JSON}`, `Evidence tier:`, `Open assumptions:`, `This segment would be proven wrong if:`. Evidence header (v2): `Customer comments (<scope>). Shown per sentiment, totals: {...}` with no statement of what a comment/study/option item *is*.

## New prompts (v3/v3.1, verbatim, template vars in {})

`parseChange` system:

> You read a BMW product manager's what-if question about the successor to the {vehicleName} (about 2030) and turn it into one structured change record.
>
> change_type - exactly one of:
> \- make_standard: something you pay for today becomes part of standard equipment at no extra price.
> \- add_option: something not offered today is added, usually as a paid option.
> \- remove: a feature that exists today is taken away.
> \- improve: an existing feature is made better or brought back, with no change in how it is bought.
> \- simplify: the same functions with fewer steps, menus, screens or controls.
> \- price_increase: the customer pays more, whether or not something is added.
> \- price_decrease: the customer pays less.
> \- other: none of these describes the change.
>
> feature_id - the ONE feature the change is mainly about: the thing the customer would actually notice. When a question touches several, pick the most specific one whose description covers it (heated front massage seats -> front_seats, not interior_quality; more trunk space -> space_practicality, not rear_comfort). Do not invent features and do not stretch: if no feature on the list covers what the customer would notice, answer null - never file a missing feature under price_value or exterior_design.
>
> summary - the change restated concretely in one plain English sentence, as the requirement a product manager would write down. Keep every part of the question (several parts stay in one sentence). Do not add benefits the question does not state.
>
> cost_impact_eur - only when the question states a money amount for the customer: a number in EUR, positive if the customer pays more, negative if less. Otherwise null.
>
> Features:
> {list of 16 features: `- id: name. description` per line}

`react` system (~650 words; THE SEGMENT = personaBrief inserted):

> Your answer feeds a BMW product manager deciding requirements for the successor of the {vehicleName} (about 2030). You simulate how ONE evidence-based customer segment — described below — would react to one proposed change. You are not a real customer and this is not a vote; you are an analyst making one segment's evidence-backed reaction legible.
>
> THE SEGMENT
> {personaBrief}
>
> WHAT THE EVIDENCE IS. You may use nothing else. Three kinds, each item tagged with an ID in square brackets:
> \- a comment = one customer from this segment's slice, in their own words; the totals line says how many comments of that sentiment exist in the slice;
> \- a study item = a survey average for the whole market (how the market rates something today), not an individual opinion;
> \- a price-list item = the current offer and its price, a fact, not an opinion.
>
> VERDICT — pick exactly one; would this change make this segment MORE or LESS likely to buy the successor?
> \- more_likely: several comments in this segment ask for or praise exactly this change (or its direct cause), little in the slice argues against.
> \- slightly_more_likely: real but weak support — few comments, adjacent topic, or opposition that is clearly outweighed. One side (support) must be stronger.
> \- no_effect: the evidence shows this segment does not care about this feature (it never appears in its slice and is outside what dominates its feedback), OR support and opposition are equally strong — when the evidence truly cuts both ways with no stronger side, choose no_effect, never a slight level. A high study rating on the current state also supports no_effect: there is nothing to gain.
> \- slightly_less_likely: real but weak opposition — few comments, adjacent topic, or support that is clearly outweighed. One side (opposition) must be stronger.
> \- less_likely: several comments complain about exactly this (or its direct cause), little argues for.
> \- not_enough_evidence: the evidence does not speak to this change for this segment at all. A good, honest answer — but not a hiding place: adjacent-topic comments and study averages DO speak to feature changes, and the totals line says how much support exists even when few comments are shown.
>
> CONFLICTING EVIDENCE: cite both sides — supporting_ids only items backing the verdict's direction, opposing_ids only items cutting against it — then lower confidence. Never cite an item as supporting that argues the other way.
> REACTION: 1-2 sentences in this segment's voice, grounded in what a cited comment actually says. No invented details: no family, children, weather, commute, competitors, prices or numbers unless an evidence item says them. No ID tags inside the text; never break character to talk about "the evidence" or "the comments".
> REASON: 1-2 sentences in an analyst's voice for the product manager: name the deciding evidence IDs and the counts that tipped the verdict (which comment IDs, how many comments want this). Never just restate the verdict — say what decided it.
> ASSUMPTIONS: at most 2 forward-looking assumptions your verdict depends on, specific to this change and segment (never restate the change or say generic things like "it works as described"). Empty list when the verdict rests only on evidence.
> CONFIDENCE: high = many matching comments all one way; medium = a few comments or study only, one way; low = thin or conflicting.
>
> WORKED EXAMPLE (invented, for form only):
> Change: panoramic sunroof standard on all trims. Segment evidence: 9 comments praising roof silence [G60-111][G60-112], 4 complaining the standard roof feels dark [G60-201][G60-202], study [STUDY-1] rating cabin brightness low in this market.
> verdict: slightly_more_likely — real requests for light, but the loud praise is for other roof qualities. supporting_ids: G60-201, G60-202, STUDY-1; opposing_ids: G60-111, G60-112.
> reaction: "The standard roof always feels dim inside — more light from the glass would genuinely please us, even if the quiet roof we have is fine."
> reason: "Two of thirteen segment comments ask for more cabin light [G60-201][G60-202] and the survey rates brightness low [STUDY-1], while nine praise the current roof's quietness [G60-111][G60-112] — real support, but outnumbered by satisfied owners."

v3.1 revision (after first A/B): the rubric lines for slightly_*/no_effect gained the "one side must be stronger / truly-cutting-both-ways → no_effect" wording, and REACTION gained "never break character". Evidence block inside `react` now opens `CUSTOMER COMMENTS — real G60 owners in this segment's slice: {scope}` + an explicit totals/sample sentence; study header reads `CUSTOMER STUDY — survey averages for this market (not opinions, an average of many answers; G70 = 7 Series shown for comparison)`; price header reads `PRICE LIST — the current offer (Germany, July 2026); a fact about today's prices, not an opinion`. `personaBrief` now prints cluster stats as readable percentages ("What this segment's own feedback is dominated by: digital_topic_share=97%, friction=52%, …"). Schema fields got descriptions pointing back to the rubric.

## A/B results (9 personas/run; runs: Q1 25edcfdf→4e216d08→5be15de0, Q2 1713be14→aaf1a8b6→905b1933, Q3 080fec23→be46082c→7f04c492, Q4 b1ecd3a4→b8723ca3→106e4585)

| Metric | Q1 v2→v3.1 | Q2 v2→v3.1 | Q3 v2→v3.1 | Q4 v2→v3.1 |
|---|---|---|---|---|
| more (+slightly) | 6 → 7 | **2 → 8** | **1 → 5** | 7 → 7 |
| none (no_effect) | 1 → 2 | 2 → 1 | **0 → 3** | 0 → 2 |
| less (±slightly) | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| not_enough_evidence | **2 → 0** | **5 → 0** | **8 → 1** | **2 → 0** |
| avg cited ids / called verdict | 5.7 → 6.2 | 2.5 → 3.1 | 4.0 → 4.5 | 4.7 → 5.4 |
| rejected (dropped) citations | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| reasons naming evidence IDs | 4 → 9 | 4 → 9 | 5 → 8 | 6 → 9 |
| ID tags leaked into reactions | 1 → 0 | 0 → 0 | 0 → 0 | 2 → 0 |

v3→v3.1 delta: Q3 verdict-vs-cited-sentiment flags 5→3 and Q3 returned 1 honest NEE; Q2 gained 1 no_effect; Q1 kept 4 flags (metric bias, see limits). Parse side: Q3 parsed identically in v2/v3 (`ev_range_charging`, `price_increase`, cost_impact_eur=2000) — the price-capture rule confirmed on a price-worded question; Q4 mapped to `controls` in both. Verdict direction shifts are not scored against ground truth (there is none); the measured gains are evidence-usage discipline.

## Example old vs new (AM-1, Q2 "Make rear-seat heating standard")

- **v2** (`1713be14`) — no_effect: R: "Rear-seat heating as standard sounds like a welcome extra, but it is not the issue that defines my experience. I care most about digital friction." E: "Some US BEV feedback requests rear-seat amenities, including heating, but there is no evidence that this change addresses the segment's defining digital-friction concerns [G60-2227] [G60-0236]."
- **v3** (`aaf1a8b6`) — slightly_more_likely: R: "The back seat feels short on amenities: it has no climate control or heated seats, which seems wrong for a car at this price." E: "The clearest direct signal is G60-2227, which explicitly calls out missing rear heated seats; three shown want comments also raise rear climate amenities [G60-0236][G60-1238][G60-2827]. The slice has 12 negative and 6 want comments overall… second-row comfort is rated 47.1% top-2-box [STUDY-1]…"
- **Q3 EU-2 v3.1** (`7f04c492`) — slightly_more_likely: R: "The range really needs to improve, but €2,000 more is a hard sell when the car already feels expensive." E: "The slice has 16 negative versus 8 positive comments… direct complaints [G60-0034][G60-0325][G60-1032]… one explicitly calls the car insanely expensive [G60-1746], making the price increase a meaningful counterweight." (v2 said NEE with no counts.)

## v3.2 (orchestrator review fix)

Review found a cost-blind bias in v3.1: across all 36 v3.1 verdicts, zero were "less likely", even for "Raise the price by €2,000 for more range". China segments said "I don't see a reason to pay more" yet scored no_effect. The worked example also contradicted the rubric (a segment "outnumbered by satisfied owners" labelled slightly_more_likely).

Changes: a PRICE rule (when the customer pays more, a feature the segment does not clearly ask for is slightly_less_likely or less_likely, not no_effect), and the worked example replaced by a price trade-off that ends slightly_less_likely. `PROMPT_VERSION = "whatif-v3.2"`.

| Question | v3.1 | v3.2 |
|---|---|---|
| Raise the price by €2,000 for more range | 5 more · 3 none · 0 less · 1 NEE (`7f04c492`) | 4 more · 0 none · 5 less · 0 NEE (`fcb5abd8`) |
| Make rear-seat heating standard on every trim (no price, control) | n/a | 7 more · 1 none · 0 less · 1 NEE (`f3d750d1`) |

The range-hungry US and EU segments still lean towards buying; the segments happy with today's range, and China, now lean away from paying more. The control without a price stays positive, so the rule does not flip normal changes.

## Remaining limits (honest)

- **The sentiment-contradiction metric is biased.** For changes that fix a problem, citing negative comments about the status quo *supports* the verdict; the metric counts comment sentiment, not support direction. Residual "contradictions" (Q1: 4) are largely this artifact, not new failure.
- **No ground truth for verdict direction.** The rubric makes verdicts consistent with cited evidence and counts; it cannot make them *right*. Q2's 8×slightly_more_likely panel could be a real signal or shared rubric-induced optimism from "want"-class comments that name rear climate but not heating specifically.
- **Adjacent-evidence NEE is still partly subjective** (Q2 AS-2 kept NEE, EU-1 moved to slight lift on study deltas) — borderline segments may flip between runs; only the deterministic guards (citation filter, cap, cache) are stable.
- **Single-segment voice can still smooth over within-segment disagreement** ("some of us…" phrasing appeared once); the 1-2-sentence limit fights the "cite both sides" rule.
- **v3.1 is a single sample per question** — borderline segments may move again on a re-run; only the deterministic guards are stable. The shipped prompt text is byte-identical to what the v3.1 runs used. Q1/Q2 v2 baselines pre-date this work; only Q3/Q4 v2 baselines were created here. ~100 OpenAI calls used, at budget (12 per fresh run × 8 new runs + Q1/Q2 v2 re-cache checks reused stored parseChange; no re-parses).
