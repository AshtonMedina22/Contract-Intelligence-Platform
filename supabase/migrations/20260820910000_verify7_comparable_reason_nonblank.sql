-- VERIFY 7 fix: blank comparable judgment reasons must be rejected.
-- Evidence: VERIFY7_ACCEPTANCE.md — empty reason insert succeeded despite UI requiring reason.

delete from public.pricing_comparable_judgments
where length(trim(coalesce(reason, ''))) = 0;

alter table public.pricing_comparable_judgments
  drop constraint if exists pricing_comparable_judgments_reason_nonblank;

alter table public.pricing_comparable_judgments
  add constraint pricing_comparable_judgments_reason_nonblank
  check (length(trim(reason)) > 0);

comment on constraint pricing_comparable_judgments_reason_nonblank on public.pricing_comparable_judgments is
  'Include/exclude rationale required — blank or whitespace-only reasons rejected (VERIFY 7).';
