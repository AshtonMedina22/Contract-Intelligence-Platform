# Product-scope guardrail — INTERNAL L&P operating platform

**Status:** Permanent. Applies to all current and future work in this repository.  
**Authority:** Overrides ambiguous “optional commercialization / future tenant” wording in other canonical docs for **implementation decisions**. Historical `docs/OG DOCS/**` files are left unchanged as archival source material.

## What this product is

The Contract Intelligence Platform is an **INTERNAL L&P Global Security operating platform**.

Authorized users are **L&P staff** who use it to:

- discover government/enterprise procurement opportunities;
- research buyers/agencies and markets;
- analyze competitors;
- analyze RFP/RFQ/IFB documents;
- verify extracted procurement facts;
- develop bid strategy;
- evaluate compliance readiness;
- build pricing;
- draft proposals;
- obtain **internal** approvals;
- generate final procurement outputs;
- submit bids **externally** through the buyer’s required channel;
- capture win/loss results;
- manage awarded contracts;
- track renewals/recompetes;
- improve future bidding intelligence.

## Entity model (do not conflate)

| Entity | Role in this product |
| --- | --- |
| **L&P Global Security** | Platform organization / operating company. Staff are the only intended product users. |
| **Buyer / agency / procurement customer** | **Data entity only** (e.g. Dallas ISD, Williamson County, TxDMV). Appears in records because L&P bids to or contracts with them. |
| **Competitor** | **Intelligence entity only**. Not a platform user or tenant. |

Procurement buyers / customers / agencies **MUST NOT** become platform users merely because L&P bids to or contracts with them.

## How outputs leave the platform

The platform generates/exports outputs that L&P submits **OUTSIDE** this application using the buyer’s required method, such as:

- procurement portal;
- email;
- PDF / DOCX;
- Google Docs working document;
- pricing workbook;
- structured copy/paste;
- physical submission where required.

There is **no** buyer-facing submission, approval, or collaboration portal inside this app.

## Do not build (current implementation)

Unless a future task **explicitly** instructs otherwise, do **not** implement:

- customer / client portal;
- buyer login / agency login;
- external customer accounts;
- customer approval workflows inside this application;
- customer collaboration workspace;
- external customer messaging portal;
- customer self-service;
- customer tenant onboarding;
- buyer-facing dashboards;
- buyer-facing proposal review;
- buyer-facing contract portal;
- Stripe billing;
- subscription / seat / usage billing plans;
- commercial SaaS onboarding;
- external contractor marketplace;
- commercialization / PaaS selling features.

## Architecture note (preserve, do not expand)

Existing `organizations` / `memberships` / RLS remain because they provide sound **authorization and data isolation** for L&P (and remain multi-tenant-ready as an engineering property).

**Do not** expand that architecture into a commercial multi-tenant SaaS product, buyer tenants, or customer onboarding unless explicitly instructed in a future task.

Do not rebuild working core architecture merely to remove future extensibility.

## Doc interpretation rule

Where older canonical text says “optional future commercialization” or “future tenants are contracting companies”:

- Treat that as **non-binding historical / optional-later language**.
- For **all implementation**, treat this guardrail as authoritative: **internal L&P operators only; buyers and competitors are data/intelligence entities only.**

## Related

- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) · [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) · [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)
- Agent rule: `.cursor/rules/canonical-product-phases.mdc` and `.cursor/rules/product-scope-internal-lp.mdc`
