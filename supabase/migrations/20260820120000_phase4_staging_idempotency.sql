-- Phase 4: parse/extract staging helpers. No canonical contracts/pricing tables.

alter table public.extraction_runs
  add column if not exists normalized_document jsonb;

alter table public.extracted_facts
  add column if not exists idempotency_key text;

update public.extracted_facts
set idempotency_key = 'legacy:' || id::text
where idempotency_key is null;

alter table public.extracted_facts
  alter column idempotency_key set default (gen_random_uuid()::text);

alter table public.extracted_facts
  alter column idempotency_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'extracted_facts_run_idempotency_key'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts
      add constraint extracted_facts_run_idempotency_key
      unique (extraction_run_id, idempotency_key);
  end if;
end $$;

create index if not exists extraction_runs_document_version_id_idx
  on public.extraction_runs (document_version_id, started_at desc);

comment on column public.extraction_runs.normalized_document is
  'Parser output (NormalizedDocument). Staging only; never a canonical contract.';
comment on column public.extracted_facts.idempotency_key is
  'Stable key within an extraction_run so retries do not duplicate facts.';
