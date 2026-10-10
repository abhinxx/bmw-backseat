# BMW Market Intelligence & Future-Customer Simulator
## Product vision and context brief for the EHL Hackathon

**Project name:** BMW Backseat - the PM drives; the customers take the backseat.
**Repository:** https://github.com/abhinxx/bmw-backseat
**Event:** [European Hackathon League](https://ehl.gg) Grand Finale, Munich, 10-11 October 2026, BMW challenge.

**Document purpose:** Introduce the product vision, business context, intended experience, boundaries, and principles. This is a product brief for a coding agent or project contributor to understand *what we are building and why*. It intentionally does not prescribe a technical stack, architecture, libraries, or implementation method.

---

## 1. The vision

BMW product managers make decisions about vehicles that may not reach customers for several years. They must decide which features to prioritize, which compromises are acceptable, and how to build a car that works for customers with different needs across markets.

Today, the evidence needed to make those decisions is fragmented. Internal customer feedback, customer studies, usage data, sales data, competitor information, press coverage, and public online conversations live in different places and have different levels of reliability. Product managers often have to find the information manually, extract it, compare it, prepare presentations, and explain why a feature deserves investment.

**We want to turn that scattered evidence into a visual, explorable decision environment.**

A product manager should be able to select a vehicle or future vehicle concept, explore the customer groups it may serve, propose a change, and see how different evidence-backed customer segments might respond. They should then be able to investigate the reasoning, compare internal evidence with outside signals, and trace important claims back to their sources.

The product should feel like an intelligent market-insight console, not a chatbot with a dashboard attached.

## 2. The problem we are solving

The central problem is not simply that BMW has too much data. It is that the evidence is difficult to combine into a clear, defensible product decision.

- **Fragmented evidence:** Internal studies, customer comments, usage information, sales figures, vehicle specifications, and external research are separated.
- **Manual synthesis:** People search, export, compare, interpret, and build presentations themselves.
- **Inconsistent AI outputs:** Similar questions or slightly different inputs can produce different recommendations.
- **Weak traceability:** A recommendation is not useful if a product manager cannot see what evidence led to it.
- **Conflicting customer needs:** A vehicle intended to appeal to everyone can become a collection of compromises that serves no one particularly well.
- **Late signals:** Online discussion and competitor changes may reveal emerging expectations before delayed ownership studies become available.
- **Uncertain external evidence:** Public posts can be useful, but may be biased, unrepresentative, duplicated, misleading, or not written by actual customers.

The opportunity is to help product managers see the trade-offs early, rather than discover them late in vehicle development.

## 3. The product in one sentence

**An evidence-led BMW product intelligence console that combines internal customer truth with curated external market signals, then makes the implications visible across customer demographics and needs.**

It should help answer questions such as:

- If we add or change a feature, who might value it, who might reject it, and what evidence supports that view?
- Do customer preferences differ across markets or demographic groups?
- Which needs are broadly shared, and which conflict?
- What are competitors offering that BMW customers are asking for, or that internal research has not yet covered?
- Is an apparent trend supported by independent sources, or is it just a loud online conversation?
- What should a product manager investigate next before advocating for an investment?

## 4. Two research capabilities, one coherent product

The product has two distinct but connected research capabilities. They should not feel like unrelated products to the user. Both should feed the same evidence-led dashboard and use the same standards for source traceability.

### A. Internal evidence intelligence

This capability works with BMW's existing evidence: customer feedback, customer studies, usage data, sales information, vehicle option lists, and other available internal material.

Its purpose is to understand what BMW's own evidence can already tell us, find relevant records, connect related findings, identify gaps, and provide a traceable foundation for product decisions.

It should understand the context of a question: the vehicle or vehicle concept, feature, market, customer group, competitor, and relevant time horizon. It should retrieve the evidence that actually applies rather than produce a generic answer.

Internal evidence is the **primary source of truth for BMW's own customers and business data**. It is not automatically perfect or complete; its coverage, definitions, age, and limitations must remain visible.

### B. External deep research

This capability investigates what is happening outside BMW's internal datasets. Relevant sources may include competitor product information, public customer discussions, Reddit, X, other accessible social platforms, press and reviews, industry reporting, and trend sources such as Google Trends where appropriate.

Its purpose is to find early signals, competitor differences, unmet needs, repeated complaints, emerging expectations, and context that internal evidence may not yet contain.

External research must be curated, not merely scraped and repeated. It should preserve links and source details, distinguish direct observations from interpretation, and consider recency, credibility, duplication, relevance, and possible bias.

A popular post is not proof of a widespread customer preference. A competitor offering a feature is not, by itself, proof that BMW should offer it. External evidence should complement and challenge internal evidence, not silently replace it.

### How the two capabilities work together

A product manager should experience one research journey:

1. Ask a question or explore a vehicle, feature, or trend.
2. See what the internal BMW evidence says.
3. See where that evidence is strong, weak, missing, or contradictory.
4. Investigate relevant external sources to fill gaps or challenge assumptions.
5. Compare signals across customer groups, markets, vehicles, and sources.
6. Review a synthesis that clearly separates facts, inferences, and open questions.
7. Drill into the original evidence and use the result to support a human decision.

The external agent must not manufacture certainty where the internal evidence is silent. It should make gaps visible and explain what outside research adds.

## 5. The customer model: demographic representation and evidence-backed personas

The dashboard should make customer diversity visible. Rather than treating a single market or one average customer as the whole audience, it should help product managers explore how needs and reactions differ across demographic groups, markets, and usage contexts.

The intended experience includes a visual representation of customer segments, with a playful but polished persona or character for each segment. The product manager can select a segment, inspect the evidence behind it, and explore how it may react to a proposed feature change.

Potential dimensions may include age bands, life stage, household or family context, market, usage patterns, driving priorities, technology preferences, comfort needs, and price sensitivity. These are candidate dimensions, not a claim that all are available in the current data.

### Personas must be grounded, not invented

The system must distinguish three things:

- **Observed data:** what internal records, studies, sales data, or sourced external material actually state.
- **Evidence-based segment interpretation:** a pattern inferred from multiple records or measurements, with the method and uncertainty visible.
- **Illustrative persona details:** a narrative or visual character used to make a segment understandable, not a factual description of a known customer.

Do not invent demographics because they make a persona feel realistic. If the data does not establish age, gender, income, family status, or another attribute, the interface must not present that attribute as known. It may instead describe a segment by its demonstrated needs, such as “comfort-focused drivers” or “customers frustrated by complex controls,” clearly labeling it as a behavioral segment.

Sales data can help describe business importance or market context, but it does not automatically explain *why* a customer bought a vehicle or what feature they prefer. Complaint volume does not automatically represent the share of all customers who hold an opinion. These measures must not be treated as interchangeable.

The product should show how each segment was derived, which sources contribute to it, how much evidence exists, and what remains unknown.

## 6. The feature-change experience

A core demonstration should let a product manager propose a change and explore its potential implications across customer groups.

Examples of questions include:

- What if rear-seat heating became standard?
- What if the available exterior colors changed?
- What if the next vehicle emphasized higher performance?
- What if a comfort feature were removed to control cost?
- What if an existing digital function became simpler to operate?
- What if a competitor introduced a feature BMW does not currently offer?

The dashboard should make differences visible: who appears to value the change, who may dislike it, where preferences conflict, and what evidence supports each interpretation.

A reaction from a persona is **not a real customer vote or a validated prediction**. It is a model-generated interpretation conditioned on available evidence. The product must make that distinction explicit. Where evidence is too weak to support a segment-specific conclusion, the right response is “insufficient evidence,” not a confident fictional opinion.

The product should help a PM explore hypotheses, not pretend that a simulation has replaced customer research.

## 7. The visual experience

The experience should be beautiful, visual, and inviting enough that a product manager can understand the market before reading a long report. It should feel like an internal premium product, not a generic analytics template.

The default view should reveal the landscape at a glance, with meaningful ways to explore detail. Possible visual elements include:

- A vehicle-focused overview with selectable cars and model context.
- Vehicle imagery and feature visuals where relevant and appropriately sourced.
- A global view of customer groups, markets, and emerging trends.
- A demographic or segment landscape showing the relative representation of groups, where the underlying data supports such a comparison.
- Visual comparisons of reactions to a proposed change.
- Clear indicators of evidence strength, source diversity, recency, and uncertainty.
- A view of where internal and external evidence agree, disagree, or leave gaps.
- Expandable evidence panels showing the original source, record, quote or metric, date, category, and context.
- A research activity view that makes the investigation understandable rather than hiding all work behind a final answer.
- A presentation-friendly summary that can help a PM explain a decision to stakeholders.

A three-dimensional character or “customer room” experience may make the demo memorable. It should support understanding and exploration, not become a gimmick that obscures the evidence. The character represents a segment, not a real identified individual.

The interface should progressively disclose detail: an immediate overview first, with deeper evidence available when requested. “Show everything by default” means the market picture should be visually rich and immediately legible, not that every raw record should be dumped onto one screen.

## 8. Context from the BMW product-manager interview

The interview describes a current workflow that is largely manual. Customer studies and usage information are available through an internal hub, but the PM must search for relevant studies, export information into Excel, assemble PowerPoint presentations, and derive implications personally.

The PM described a desired experience with:

- A clear high-level prioritization of functions.
- The ability to drill into the requirements or evidence beneath a category.
- Explanations that show why a recommendation was made.
- Backing evidence such as competitor capabilities and complaints about previous vehicle versions.
- Visual communication that helps persuade vehicle-project leadership to approve investment.
- Consideration of customer feedback, competitor activity, and broader trends, including digital trends from other industries.
- A way to balance regional differences, such as differences between US and Chinese customers.
- Careful treatment of online feedback because the identity and representativeness of posters may be unclear.
- Greater confidence when the same signal appears independently across multiple channels.
- A dashboard as the primary experience, with presentation export potentially useful.
- A future possibility of connecting decisions to Codebeamer, the engineering requirements system, but not necessarily as the immediate core of the product.

The PM was especially clear that a recommendation needs a traceable explanation because vehicle development involves major investment decisions and decision gates. Human review remains important.

The interview also contained a practical warning: modeling the entire BMW portfolio and its internal feature-allocation logic is complex. The direction has since expanded to explore broader datasets and customer groups. That expansion should enrich the vision without pretending every dataset is equally complete or directly comparable.

## 9. Data context and source hierarchy

The project has access to several internal data assets, including:

- Feedback workbooks for G60, G70, and F70.
- Vehicle option-list PDFs for those models.
- A customer-studies workbook spanning F70, G60, G68, and G70.
- A sales-volume workbook.
- A BMW product-manager interview transcript.

The feedback workbooks include customer comments and BMW taxonomy classifications, alongside fields such as source, country, vehicle derivation, engine type, feedback type, and feature category. Some comments are linked to multiple categories, so row counts must not automatically be treated as independent customer counts.

The datasets vary in what they can support. A feedback record, a study response, a vehicle specification, a sales-volume figure, and a public social post are different evidence types. They should not be merged into one undifferentiated score.

Use this hierarchy of interpretation:

1. **Internal measured or recorded evidence:** the strongest basis for claims about the BMW data itself, subject to its sampling, definitions, and quality.
2. **External primary sources:** official competitor specifications, original press material, and original public posts or reviews, with provenance retained.
3. **External secondary analysis:** industry reports, media summaries, trend analysis, and other interpretation, with source and date visible.
4. **Agent interpretation:** synthesis or hypotheses derived from the above, always distinguishable from the source facts.

No source class is infallible. The interface should make provenance and limitations inspectable instead of hiding them behind a single confidence badge.

## 10. Principles that should govern every result

### Traceability
Every material claim should link to its supporting evidence. Users must be able to inspect the original record or source and understand why it is relevant.

### Separation of fact and inference
The interface must distinguish source facts, calculated metrics, inferred patterns, and model-generated hypotheses.

### Consistency
The same evidence, question, and evaluation criteria should lead to a reasonably stable analytical process. Any prioritization method should be visible and explainable.

### Balanced evidence
Show supporting and contradicting signals. Do not cherry-pick evidence to justify the feature the user already wants.

### Honest uncertainty
Display missing information, sample limitations, source bias, stale information, and conflicting findings. “We do not know yet” is a valid and useful result.

### Global perspective
Avoid assuming that preferences from one market apply everywhere. Compare regions where comparable evidence exists and preserve local context.

### Customer diversity without stereotyping
Segments should reveal differences in needs, not reduce people to clichés. Demographic labels must be supported by evidence and handled respectfully.

### Human decision-making
The tool informs and challenges product decisions. It does not independently approve features, investments, or vehicle requirements.

### Visual clarity
Make complex relationships easier to understand. Visual polish should clarify the evidence, not make weak conclusions look authoritative.

## 11. What we are explicitly not building

- **Not a generic chatbot.** Chat can be an entry point, but the main value is the connected research and visual decision environment.
- **Not a dashboard of disconnected charts.** Every important visual should help answer a product question and connect to underlying evidence.
- **Not a persona role-play game.** Characters should represent evidence-backed segments and expose differences in needs, not invent opinions freely.
- **Not a fake customer simulator.** A generated reaction is not a real vote, survey result, or proven forecast.
- **Not a demographic guessing machine.** Do not infer personal attributes without supporting evidence or turn behavioral patterns into unsupported biographies.
- **Not a popularity contest based on social media volume.** Online volume is not representative market share or proof of broad customer demand.
- **Not an indiscriminate web scraper.** External research must be relevant, source-aware, legally and platform-policy aware, and curated for quality.
- **Not an automatic replacement for BMW's internal research.** External signals supplement internal evidence and can reveal gaps, but must not silently overwrite it.
- **Not a single magic score.** Customer complaints, sales, study ratings, competitor features, and social trends have different meanings and should not be collapsed into one opaque number.
- **Not an automatic decision-maker.** Humans remain responsible for prioritization and investment decisions.
- **Not a full BMW portfolio-optimization engine in the first expression of the vision.** Portfolio logic is complex; the product should first make evidence and customer trade-offs understandable.
- **Not a Codebeamer replacement.** Codebeamer stores detailed engineering requirements. Direct integration or requirement export may be a later extension, not the purpose of this product.
- **Not a claim that all datasets are globally representative.** Data coverage and comparability must be visible.
- **Not a beautiful interface that hides weak evidence.** Visual confidence must never exceed evidential confidence.

## 12. What success looks like

A product manager can open the console and quickly understand the customer and market landscape for a vehicle or proposed feature. They can explore the groups affected by a change, see where needs align or conflict, compare internal evidence with external signals, and inspect the sources behind a conclusion.

When the PM asks “Why?”, the product does not merely produce another paragraph. It reveals the supporting evidence, the opposing evidence, the reasoning, the source quality, and the unanswered questions.

The PM can use the result to have a better discussion with vehicle-project leadership: what deserves further investigation, what may justify investment, what trade-offs exist, and what is still uncertain.

The product succeeds when it turns scattered information into a clearer, more defensible human decision.

## 13. The guiding mental model

Think of the product as **a market observatory and customer-simulation room for future BMW vehicles**.

- The observatory gathers and organizes signals from inside and outside BMW.
- The customer landscape shows how needs vary across segments and markets.
- The feature-change experience lets the PM explore hypotheses and trade-offs.
- The evidence trail makes each conclusion inspectable.
- The human PM remains the decision-maker.

The ambition is broad: help BMW understand not just what customers said about cars already on the road, but what different kinds of customers may need from the vehicles BMW is designing next.

The product should make that future easier to explore, without pretending that uncertainty has disappeared.
