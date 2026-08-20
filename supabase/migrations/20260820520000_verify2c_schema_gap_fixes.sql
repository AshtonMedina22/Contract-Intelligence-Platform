-- VERIFY 2C fix: close nonblocking schema gaps from docs/pilot/VERIFY2C_ACCEPTANCE.md
-- Evidence: PKG-06 provenance; PKG-05/07/10 tab grain ownership; PKG-12/13 amendments.

-- ---------------------------------------------------------------------------
-- 1) required_forms — restore document provenance (PKG-06)
-- ---------------------------------------------------------------------------
alter table public.required_forms
  add column if not exists source_document_id uuid;

alter table public.required_forms
  drop constraint if exists required_forms_document_same_org_fkey;

alter table public.required_forms
  add constraint required_forms_document_same_org_fkey
  foreign key (source_document_id, organization_id)
  references public.documents (id, organization_id)
  on delete set null;

comment on column public.required_forms.source_document_id is
  'Solicitation PDF that listed the form (PKG-06).';

-- ---------------------------------------------------------------------------
-- 2) competitor_bids — remove rate columns that duplicate competitor_pricing_lines
--    Tab hourly/OT/holiday rows belong only on competitor_pricing_lines (PKG-05/07/10).
--    competitor_bids keeps quoted_amount + optional rank as outcome summary.
-- ---------------------------------------------------------------------------
alter table public.competitor_bids
  drop column if exists hourly_rate,
  drop column if exists rate_type;

comment on table public.competitor_bids is
  'Competitor bid outcome summary (quoted_amount, rank). Line rates live in competitor_pricing_lines.';

comment on table public.competitor_pricing_lines is
  'Bid-tab line grain (vendor × labor × rate_type × site). Sole home for competitor hourly/OT/holiday rates.';

-- ---------------------------------------------------------------------------
-- 3) contract_amendments — pilot grain for PKG-12 Amend 4 / PKG-13 riders
--    Table already existed (phase9); enrich amendment_number + title only.
-- ---------------------------------------------------------------------------
alter table public.contract_amendments
  add column if not exists amendment_number text,
  add column if not exists title text;

comment on column public.contract_amendments.amendment_number is
  'Buyer amendment number when stated (e.g. TFC Amend 4).';
comment on column public.contract_amendments.title is
  'Short amendment title / subject when stated on the instrument.';
comment on table public.contract_amendments is
  'Executed contract amendments/modifications with provenance. PKG-12 SRC-16; PKG-13 SRC-18.';

-- ---------------------------------------------------------------------------
-- 4) contract_service_plans — evidence-only comment (remove UX-driven wording)
-- ---------------------------------------------------------------------------
comment on table public.contract_service_plans is
  'Awarded contract site/post/classification rows. Evidence: PKG-02 Allen; PKG-12 TFC Level II vs III.';
