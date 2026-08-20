# Phase 2 acceptance evidence

Date: 2026-08-19  
Supabase project ref: `lhmurblikkcomdxcrymx`  
Vercel production: https://contract-intelligence-platform-web.vercel.app  
Command: `npm run test:phase2-rls`  
Result: **48 passed, 0 failed**

Disposable Auth users and organizations were created for the run and deleted in teardown. IDs are not recorded here.

## Migrations applied

- `20260819100000_phase2_tenancy_provenance.sql`
- `20260819224352_phase2_atomic_org_and_integrity.sql` (empty CLI duplicate placeholder)
- `20260819224603_phase2_atomic_org_and_integrity.sql` (composite FKs, storage path helper, initial RPC)
- `20260819232012_phase2_org_bootstrap_definer.sql` (empty CLI duplicate placeholder)
- `20260819232015_phase2_org_bootstrap_definer.sql` (atomic org bootstrap RPC)
- `20260819233000_phase2_advisor_fixes.sql` (org insert only via RPC; admin-only membership insert)

## Matrix

| Area | Result |
| --- | --- |
| Atomic org + first admin membership | Pass |
| Cross-tenant SELECT on all 12 Phase 2 tables | Pass |
| Cross-tenant INSERT / UPDATE / DELETE | Pass |
| Cannot join another org or self-promote | Pass |
| Same-organization composite foreign keys | Pass |
| Facts default to `AI_EXTRACTED` | Pass |
| `HUMAN_VERIFIED` requires `verified_by` + `verified_at` | Pass |
| Intake + evidence tenant path isolation | Pass |
| Evidence append-only (no upsert/update/delete) | Pass |
| Malformed storage paths denied | Pass |
| `npx supabase db advisors` | No issues found |

## Role decision

Option A: roles are stored (`admin`, `importer`, `verifier`, `bidder`, `executive`). Organization/member administration is admin-only. Domain permission matrices start in the first later phase that exposes those mutations.

## Credential posture

This environment is setup-only: no production/customer data, no historical corpus, no live users. Chat-exposed credentials are acceptable for setup/testing only.

Before any real L&P data is imported, or before calling the platform production-ready: rotate the Supabase secret key and database password, update Vercel Production/Preview, redeploy, and confirm secrets were never committed.

Do not start Phase 4 (processor, OCR, verification workbench) without explicit approval.
