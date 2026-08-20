# Phase 6 acceptance

Evidence-based parser routing. AI still never auto-promotes. Canonical `contracts` / `pricing_lines` are still Phase 7.

## What landed

- Checked-in policy: [ROUTING_POLICY.md](ROUTING_POLICY.md) and `lp_processor/routing_policy.json`
- Processor `select_parser` uses the policy, including scan detection on PDF bytes (empty/low-text PDFs escalate; they do not silently succeed as native)
- Eval harness: `python -m lp_processor.evals.harness` writes [benchmarks/PILOT_RESULTS.md](benchmarks/PILOT_RESULTS.md)
- Metrics on fixtures: table-cell accuracy, requirement/entity/date recall, provenance, forms (n/a until a form parser exists), scan escalate, time, $0 API
- Cloud Run **not** required by this evidence

## Honest corpus status

**0** real L&P packages scored. Fixture cases lock routes we already proved in Phase 4. Missing package types are listed in the results table. Do not treat this as the 20–30 package pilot until those files are ingested and verified.

## Checks

```powershell
cd services/processor
.\.venv\Scripts\Activate.ps1
pytest
python -m lp_processor.evals.harness
```

`GET /health` includes `routing_policy.version`.

## Out of scope (still true)

Full corpus migration, wiring Mistral/Document AI/Docling because a vendor slide said to, four-truth schema (Phase 7), Cloud Run.
