# Repository

Public-Sector CLM — https://github.com/benjaminbellman/contract-lifecycle-management

Registered as **#11** in [EXTERNAL_REFERENCE_REPOS.md](../EXTERNAL_REFERENCE_REPOS.md) under
"Contract domain / changes / renewal / obligations".

# Task that caused inspection

Productization P10 — Contract Portfolio + Renewal / Rebid Command Center. Used as a checklist against
the question *"which standard contract-lifecycle mechanics are we missing on the Changes and
Commercial Terms tabs?"*

# Relevant upstream material inspected

Repository metadata and description (2026-08-21). License status confirmed via the GitHub API. The
repo is documentation, schemas and workflow description rather than a deployable application. **No
source or schema files were copied.**

# Relevant patterns found

The documented lifecycle is Request → Draft → Review → Approvals → Signature → Active → Obligations →
Amendments → Renewals → Closeout, with obligations, amendment lineage, document versions, contract
events and audit logging as distinct entities.

# What maps to our codebase

Only the right-hand half of that lifecycle. L&P does not author the contract — a buyer awards it — so
everything from Request through Signature belongs to the buyer's system, not ours. Our surface starts
at **Active** and covers Obligations, Amendments, Renewals and Closeout, which is exactly the span of
`contracts` / `contract_amendments` / `contract_options` / `renewals` / `contract_alerts`.

# What we are adopting

Vocabulary and completeness checklist only:

- The Original → Amendment → Modification → Option → Renewal sequence as an explicit, ordered
  timeline rather than two unordered tables (`buildChangeTimeline`).
- Amendment lineage as **append-only**: a later instrument is a new entry with its own source and
  never overwrites the one before it (`CHANGE_HISTORY_APPEND_ONLY_NOTE`).
- Instrument precedence as a stated reading order (`COMMERCIAL_PRECEDENCE`), which is where the
  checklist was most useful — we had the instruments but had never written down which one speaks.

# What we are explicitly NOT adopting

- **Request / Draft / Review / Approvals / Signature.** We are not a CLM and do not author, redline,
  route or execute contracts.
- Its obligations entity. We deliberately did not add an obligations table; P10 makes no schema
  change, and "next action" is derived from dates already recorded on existing instruments.
- Its RBAC model — Supabase org-scoped RLS is authoritative here.
- Any implication that precedence should *automatically* overwrite an earlier term. Ours is a reading
  order for a person; nothing in the app rewrites a term because a later instrument exists.

# License/copy implications verified

**No license file** as of 2026-08-21 (GitHub API returns `license: null`). Unlicensed ⇒
**REFERENCE ONLY** under the external-reference-repos rule. No code, schema DDL or documentation text
was copied; the adoption is a vocabulary checklist.

# Local files affected

`apps/web/lib/contracts/portfolio-model.ts`,
`apps/web/app/(platform)/contracts/[contractId]/changes/page.tsx`,
`apps/web/app/(platform)/contracts/[contractId]/commercial-terms/page.tsx`,
`docs/functionality/F5_RECOMPETE_RADAR_ACCEPTANCE.md` (F5: renewal/expiration opportunity is advisory queue + human Start Rebid — not CLM auto-renew)

# Status

INSPECTED FOR TASK — partial vocabulary adopted, lifecycle stages before **Active** declined · F5 (2026-08-21) still not a CLM
