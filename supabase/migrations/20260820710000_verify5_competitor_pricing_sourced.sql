-- VERIFY 5 fix: competitor pricing lines must be sourced (parity with competitor_bids).
-- Evidence: VERIFY5_ACCEPTANCE.md — unsourced competitor_pricing_lines insert was allowed.

-- Remove any unsourced rows before enforcing (cannot invent provenance).
delete from public.competitor_pricing_lines
where source_document_id is null
  and source_fact_id is null;

alter table public.competitor_pricing_lines
  drop constraint if exists competitor_pricing_lines_has_source;

alter table public.competitor_pricing_lines
  add constraint competitor_pricing_lines_has_source check (
    source_document_id is not null
    or source_fact_id is not null
  );

comment on constraint competitor_pricing_lines_has_source on public.competitor_pricing_lines is
  'Competitor pricing lines require a document or verified fact source — no unsourced rates.';
