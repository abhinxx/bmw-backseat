# Subagent briefs (research phase)

Model: qwen3.8-flash-next via `atira` provider, reasoning medium (config: delegation.*). Max 4 concurrent.

## Shared rules (pasted into every child)

GO: (prefix disarms the question-gate hook; goals must start with it)

- Project: /Users/abhinavsingh/Documents/codes/ehl-hackathon. Python: `.venv/bin/python` there (openpyxl, pandas, pypdf, pdfplumber installed). Do not install anything. Raw data in `BMW-Data/` is READ-ONLY.
- Outputs: report `research/<ID>_<topic>.md`, machine data `research/data/<ID>_*.json`, every script `research/scripts/<ID>_*.py`. Write the report ONCE at the end. Files >15KB cannot be overwritten (hook); use patch, or write a new file.
- Evidence discipline (false-positive guard):
  - Every number must come from a saved script you actually ran. No mental arithmetic, no estimates presented as counts.
  - Rows != customers. Report rows AND unique IDs. Note multi-category duplication.
  - Tag every finding: [OBSERVED] raw fact, [COMPUTED] script metric, [INFERRED] your interpretation, [OPEN] unknown.
  - Every example quote carries its record ID. Never paraphrase a quote as if verbatim.
  - Never invent demographics (age, gender, income, family). If the data lacks it, say "not in data".
  - "Unknown" and "insufficient evidence" are valid results.
- Loop guard (self-harm guard):
  - Never repeat an identical failing call. Same approach fails twice -> switch approach or stop and report.
  - A result starting "BLOCKED by <hook>" is policy, not a bug: do not retry it; adapt once (e.g. path), else report it verbatim.
  - Budget ~60 tool calls. No browser. No git commits. Do not delete or move files.
- Final reply: <=300 words: key findings, file paths written, caveats, anything you could not do.

## Tasks

- A: G60 feedback content analysis (themes, likes/dislikes by taxonomy, by country/engine/source, quotes, candidate behavioral segments).
- B: G70 feedback content analysis (same as A).
- C: F70 feedback content analysis (same as A).
- D: Cross-file data audit of the 3 feedback workbooks (schema, duplicates, multi-category rows, source/country coverage, unclassified rate, language mix, comparability).
- E: Customer studies workbook (CN_EU_2025, US_2025): full structure, scales, sample bases, model x market comparability, top/bottom attributes.
- F: Option-list PDFs F70/G60/G70 (German, Jul 2026): structured standard vs optional features, packages, prices, cross-model differences.
- G: External research landscape (web only, no browser): competitors, public complaint themes, sources usable for G60/G70, with links and credibility notes.
