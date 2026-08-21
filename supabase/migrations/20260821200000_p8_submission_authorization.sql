-- P8 submission authorization + submission logistics.
-- A submission record is a human act: `submitted_at` may only exist with the human who recorded it.
-- Nothing here submits, signs, or approves anything.

alter table public.submission_packets
  add column if not exists submitted_by uuid references auth.users (id),
  add column if not exists submission_url text,
  add column if not exists submission_instructions text;

comment on column public.submission_packets.submitted_by is
  'Human who recorded the submission. Required whenever submitted_at is set — never set by automation.';
comment on column public.submission_packets.submission_url is
  'Buyer portal / upload URL as published by the buyer. Not a link the platform submits to.';
comment on column public.submission_packets.submission_instructions is
  'Buyer submission instructions as published (copies, labelling, delivery address, portal steps).';

-- Backfill is not possible without inventing an actor, so any pre-existing submitted row keeps
-- its timestamp and the constraint is added NOT VALID: new and updated rows are enforced.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_packets_submitted_requires_actor'
      and conrelid = 'public.submission_packets'::regclass
  ) then
    alter table public.submission_packets
      add constraint submission_packets_submitted_requires_actor
      check (submitted_at is null or submitted_by is not null) not valid;
  end if;
end $$;

comment on constraint submission_packets_submitted_requires_actor on public.submission_packets is
  'submission_packets.submitted_at requires submitted_by — a submission is always attributed to a human.';
