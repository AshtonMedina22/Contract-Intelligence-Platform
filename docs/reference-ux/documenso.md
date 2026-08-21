# Documenso (app) — P8 Submission / Result UX

https://github.com/documenso/documenso

# Task that caused inspection

P8 Submission/Result — completion/status/action bar UX only (2026-08-21). No clone.

# License/copy implications verified

**AGPL-3.0** — GitHub SPDX + `LICENSE` on `main` (GNU Affero GPL v3). **UX reference only.** Do not install, vendor, or copy app source. Prefer public docs + design screenshots; `documenso/design` assets need their own LICENSE check before any asset copy.

# Relevant patterns (docs, not source)

Document lifecycle from [Document Lifecycle](https://docs.documenso.com/docs/concepts/document-lifecycle) / signing workflow docs:

| State | Meaning for us |
| --- | --- |
| Draft | Packet being prepared; mutable checklist + outputs |
| Pending | Explicitly sent / awaiting external or internal required actions |
| Completed | All required actions done; immutable packet record + audit |
| Rejected / void | Hard stop; new attempt required (map to our cancelled / redo) |

UX shape to **adapt** (rebuild in our shell, not port):

1. **Sticky completion / status + action bar** — primary CTA changes by state (Prepare → Mark ready → Record submitted); secondary: download, resend reminder, void/cancel.
2. **Required-action checklist** — per-item done / blocked / waiting; progress = count of required items, not a fake score.
3. **Recipient/role progress** (if we ever have multi-approver) — Not opened / Opened / Done; no auto-advance to Completed without the terminal human action.
4. **Explicit transition only** — Draft → Pending only on intentional Send/Submit; Pending → Completed only when all required roles finish **or** operator records external portal confirmation. Never auto-submit on checklist green.
5. **Post-complete freeze** — completed packet immutable; audit trail + download; edits require a new version / re-open flow.
6. **Confirm before irreversible Complete** — Documenso’s “review carefully before completing” maps to our Confirm submission dialog (timestamp, method, confirmation id).

# What we are NOT adopting

- E-sign product, recipient portal, certificate sealing, Prisma stack.
- Auto-complete when fields are filled.
- Replacing Google Docs working-proposal handoff.

# Maps locally

`submission-workbench.tsx`; Pursuit tabs Submission | Result; UX_UI checklist (sections, forms, approvals, method, timestamp/confirmation).

# Status

INSPECTED FOR TASK — AGPL confirmed; UX patterns only
