# F12 reference — BidBridge / ExpiryGuard / OpenContracts

**Status:** Pattern references only. No code copied into this repository for F12.

## BidBridge

- URL: https://github.com/chetanmaviti/BidBridge
- Role consulted: SAM entity / set-aside / NAICS profile UX ideas for org registration fields.
- License: **Verify before any copy.** Treat as reference-only until LICENSE is confirmed permissive for adoption. F12 implements our own `organization_registrations` schema and deterministic match rules — no BidBridge dependency.
- Adopted: none (field vocabulary awareness only: UEI, CAGE, NAICS, SAM status).
- Declined: AI eligibility scores, auto set-aside “you qualify” declarations, second opportunity engine (F2 owns SAM opportunity search).

## ExpiryGuard

- URL: https://github.com/sanjayselvaraj/expiryguard
- License: **MIT** (confirmed on repo LICENSE).
- Role consulted: credential expiration tracking / reminder cadence patterns.
- Adopted: reminder discipline only — we **reuse F9** `compliance_expiration` on `compliance_items.expires_on` (including mirrored SAM registration rows). **No second scheduler.**
- Declined: ExpiryGuard app, its notification stack, certificate file parsers as a product dependency.

## OpenContracts

- URL: https://github.com/Open-Source-Legal/OpenContracts
- License: documented elsewhere as MIT for mechanics; UX references may note AGPL surfaces — see [opencontracts.md](opencontracts.md).
- Role consulted: View Source / human verification as ground truth.
- Adopted: link inventory rows to `source_document_id` / verification workbench; HUMAN_VERIFIED requires actor.
- Declined: PAWLs coordinates, corpus MCP, whole OpenContracts product.

## F12 local rules (authoritative)

- Never fabricate certifications or insurance limits.
- AI cannot set `HUMAN_VERIFIED` or `VERIFIED_AVAILABLE`.
- Missing source ≠ `VERIFIED_AVAILABLE`.
- Eligibility rollup is advisory with a hard caveat — never GPT legal opinion.
