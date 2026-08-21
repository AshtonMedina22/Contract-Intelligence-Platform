# F23 — Public Procurement Corpus Acquisition + Intelligence Enrichment Engine

**Date:** 2026-08-21  
**Status:** Implemented + acquisition run executed · Does **not** complete Historical Pilot exit  
**Run:** `npm run corpus:acquire` · `npm run test:f23-corpus` · `npm run report:corpus-coverage`

## Scope

Reusable acquisition engine that seeds exact public URLs, downloads when legally reachable, checksums, and vault-ingests via **existing F1** `register_ingested_document` as **`AI_EXTRACTED` only**. Reuses F2/F16 providers, F3 USAspending, and F4 research planes — **no second pipeline**, **no second scheduler**.

## Hard rules (enforced)

| Rule | How |
| --- | --- |
| Never fabricate sources | Only F23A registry URLs + live provider responses + party hunt stubs (portal bookmarks) |
| Never bypass auth/CAPTCHA/paywalls | HTTP 401/403 → `MANUAL_IMPORT`; no scrape bypass |
| Never `HUMAN_VERIFIED` from acquire | `ingestSetsHumanVerified() === false`; ingest returns `verificationStatus: AI_EXTRACTED` |
| Never label competitor history as L&P | Conservative classifier; competitor party stubs → `COMPETITOR_EVIDENCE` |
| Authority 3 = discovery lead | `isDiscoveryLeadOnly(3)`; web spot-search logs only |
| No second scheduler | Idempotent CLI; F9 hook documented (same `run_intelligence_automation` rail later) |

## Schema (`20260821340000_f23_corpus_acquisition.sql`)

- `acquisition_candidates` — role, authority 1\|2\|3, URL, status, sha256, document_id, package_key, search_log, org RLS
- `acquisition_saturation_runs` — honest query log (USAspending / SAM / Socrata / web)

## Lib (`apps/web/lib/corpus/`)

| Module | Role |
| --- | --- |
| `types.ts` | Roles, statuses, authority |
| `classify-role.ts` | Conservative role + authority |
| `seed-from-registry.ts` | Parse F23A txt |
| `seed-from-parties.ts` | Buyer/competitor hunt stubs |
| `fetch-candidate.ts` | Download, magic check, sha256 |
| `ingest-candidate.ts` | F1 vault path, AI_EXTRACTED only |
| `coverage-report.ts` / `saturation-report.ts` | Honest reports |

### Role → corpus_class

| Role | Class |
| --- | --- |
| `L_AND_P_DIRECT` | `A_LP_ORIGINATED` |
| `BUYER_HISTORY` | `B_LP_TIED` |
| `COMPETITOR_EVIDENCE` / `COMPARABLE_SECURITY` | `C_COMPETITOR_TEST` |
| `REFERENCE_DATA` | no fake package class |

## CLI

```bash
npm run corpus:acquire          # seed → fetch → checksum → ingest → docs/corpus/*.md
npm run test:f23-corpus
npm run report:corpus-coverage
```

Downloads: `docs/corpus/downloads/` and `docs/pilot/acquired/` (**gitignored**). Never commit PDF/DOCX/XLSX.

## F9 hook

Documented in [SOURCE_PROVIDER_REGISTRY.md](../corpus/SOURCE_PROVIDER_REGISTRY.md): optional future non-mutating notification kind on the **same** intelligence automation cron — **not** a new job.

## Artifacts

- [ACQUISITION_RUN.md](../corpus/ACQUISITION_RUN.md) — exact URLs acquired/failed
- [CORPUS_COVERAGE.md](../corpus/CORPUS_COVERAGE.md)
- [ACQUISITION_SATURATION.md](../corpus/ACQUISITION_SATURATION.md)
- [SOURCE_PROVIDER_REGISTRY.md](../corpus/SOURCE_PROVIDER_REGISTRY.md)
- Seed: [F23A_Exact_Public_Source_URL_Registry.txt](../corpus/F23A_Exact_Public_Source_URL_Registry.txt)

## Acceptance

```bash
npm run test:f23-corpus
npm run test:f1-ingestion
npm run test:f2-opportunity-engine
npm run test:f3-federal-awards
npm run test:f16-texas-local
npm run test:phase2-rls
npm run lint && npm run typecheck && npm run build
```

## Honest limits

- SAM without `SAM_GOV_API_KEY` → MANUAL/LINK only
- TOPS / many portals → HTML `LINK_ONLY`
- USAspending rows are **REFERENCE_DATA** links — not fabricated procurement packages
- Web spot-search does not scrape SERPs or invent URLs
- Historical Pilot exit (~20–30 human-verified A/B packages) remains unmet
