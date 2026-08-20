-- Canonical Phase 5 - Intelligence honesty: reuse enum label + win/loss lessons.
-- Evidence: MASTER_BLUEPRINT reuse states; Prompt 5 Win/Loss lessons field.

alter type public.reuse_status rename value 'REVIEW' to 'REVIEW_REQUIRED';

alter table public.win_loss_reviews
  add column if not exists lessons_learned text;

comment on column public.win_loss_reviews.lessons_learned is
  'Internal lessons after outcome - separate from documented_reason (evaluator) and internal_analysis.';

comment on type public.reuse_status is
  'Historical content reuse: APPROVED | REVIEW_REQUIRED | DO_NOT_USE | SUPERSEDED.';
