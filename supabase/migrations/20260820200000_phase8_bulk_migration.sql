-- Phase 8: controlled bulk historical migration batches.
-- Checksum/dedupe first. No Cloud Run. Verification stays the bottleneck.

create type public.batch_migration_status as enum (
  'OPEN',
  'INGESTING',
  'READY',
  'PROCESSING',
  'COMPLETE',
  'PARTIAL',
  'FAILED'
);

create type public.batch_item_outcome as enum (
  'INGESTED',
  'DUPLICATE',
  'FAILED'
);

alter table public.document_batches
  add column if not exists status public.batch_migration_status not null default 'OPEN',
  add column if not exists file_count integer not null default 0,
  add column if not exists ingested_count integer not null default 0,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add column if not exists processed_count integer not null default 0,
  add column if not exists api_cost_usd numeric(12, 4) not null default 0,
  add column if not exists compute_cost_usd numeric(12, 4) not null default 0,
  add column if not exists bytes_ingested bigint not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists last_error text;

comment on column public.document_batches.status is
  'Bulk migration lifecycle. PROCESSING fans out parse/extract; human verification is still required.';

create table public.batch_ingest_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_id uuid not null,
  filename text not null,
  sha256 text,
  document_id uuid,
  byte_size bigint,
  outcome public.batch_item_outcome not null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint batch_ingest_items_batch_same_org_fkey
    foreign key (batch_id, organization_id)
    references public.document_batches (id, organization_id)
    on delete cascade,
  constraint batch_ingest_items_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null
);

create index batch_ingest_items_batch_id_idx on public.batch_ingest_items (batch_id);
create index batch_ingest_items_organization_id_idx on public.batch_ingest_items (organization_id);

alter table public.batch_ingest_items enable row level security;

create policy batch_ingest_items_all on public.batch_ingest_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.batch_ingest_items to authenticated;

create or replace function public.create_migration_batch(
  p_organization_id uuid,
  p_label text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not an organization member';
  end if;
  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'Batch label is required';
  end if;

  insert into public.document_batches (
    id, organization_id, label, created_by, status, started_at
  )
  values (
    new_id, p_organization_id, btrim(p_label), auth.uid(), 'OPEN', now()
  );

  return new_id;
end;
$$;

create or replace function public.record_batch_ingest_item(
  p_organization_id uuid,
  p_batch_id uuid,
  p_filename text,
  p_sha256 text,
  p_document_id uuid,
  p_byte_size bigint,
  p_outcome public.batch_item_outcome,
  p_error_message text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not an organization member';
  end if;

  insert into public.batch_ingest_items (
    organization_id,
    batch_id,
    filename,
    sha256,
    document_id,
    byte_size,
    outcome,
    error_message
  )
  values (
    p_organization_id,
    p_batch_id,
    p_filename,
    p_sha256,
    p_document_id,
    p_byte_size,
    p_outcome,
    nullif(btrim(p_error_message), '')
  );

  update public.document_batches b
  set
    file_count = b.file_count + 1,
    ingested_count = b.ingested_count + case when p_outcome = 'INGESTED' then 1 else 0 end,
    duplicate_count = b.duplicate_count + case when p_outcome = 'DUPLICATE' then 1 else 0 end,
    failed_count = b.failed_count + case when p_outcome = 'FAILED' then 1 else 0 end,
    bytes_ingested = b.bytes_ingested + coalesce(
      case when p_outcome = 'INGESTED' then p_byte_size else 0 end,
      0
    ),
    status = case
      when b.status = 'OPEN' then 'INGESTING'::public.batch_migration_status
      else b.status
    end,
    last_error = case when p_outcome = 'FAILED' then nullif(btrim(p_error_message), '') else b.last_error end
  where b.id = p_batch_id
    and b.organization_id = p_organization_id;
end;
$$;

create or replace function public.finalize_batch_ingest(
  p_organization_id uuid,
  p_batch_id uuid
)
returns public.batch_migration_status
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.document_batches%rowtype;
  next_status public.batch_migration_status;
begin
  select * into b
  from public.document_batches
  where id = p_batch_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Batch not found';
  end if;

  if b.failed_count > 0 and b.ingested_count + b.duplicate_count > 0 then
    next_status := 'PARTIAL';
  elsif b.failed_count > 0 and b.ingested_count + b.duplicate_count = 0 then
    next_status := 'FAILED';
  elsif b.ingested_count = 0 and b.duplicate_count > 0 then
    next_status := 'COMPLETE';
  else
    next_status := 'READY';
  end if;

  update public.document_batches
  set status = next_status
  where id = p_batch_id;

  return next_status;
end;
$$;

create or replace function public.mark_batch_processing(
  p_organization_id uuid,
  p_batch_id uuid,
  p_document_count integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.document_batches
  set
    status = 'PROCESSING',
    processed_count = 0,
    compute_cost_usd = compute_cost_usd + (p_document_count * 0.0001),
    last_error = null
  where id = p_batch_id
    and organization_id = p_organization_id;
end;
$$;

create or replace function public.record_batch_document_processed(
  p_organization_id uuid,
  p_batch_id uuid,
  p_success boolean,
  p_error text default null
)
returns public.batch_migration_status
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.document_batches%rowtype;
  next_status public.batch_migration_status;
  pending integer;
begin
  select * into b
  from public.document_batches
  where id = p_batch_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Batch not found';
  end if;

  update public.document_batches
  set
    processed_count = processed_count + 1,
    last_error = case when p_success then last_error else coalesce(nullif(btrim(p_error), ''), last_error) end,
    api_cost_usd = api_cost_usd + case when p_success then 0 else 0 end
  where id = p_batch_id;

  select count(*)::integer into pending
  from public.documents d
  where d.batch_id = p_batch_id
    and d.organization_id = p_organization_id
    and d.processing_status in ('UPLOADED', 'QUEUED', 'PARSING', 'EXTRACTING', 'VALIDATING');

  if pending = 0 then
    select * into b from public.document_batches where id = p_batch_id;
    if b.failed_count > 0 then
      next_status := 'PARTIAL';
    else
      next_status := 'COMPLETE';
    end if;
    update public.document_batches
    set status = next_status, finished_at = now()
    where id = p_batch_id;
    return next_status;
  end if;

  return 'PROCESSING';
end;
$$;

revoke all on function public.create_migration_batch(uuid, text) from public;
revoke all on function public.record_batch_ingest_item(uuid, uuid, text, text, uuid, bigint, public.batch_item_outcome, text) from public;
revoke all on function public.finalize_batch_ingest(uuid, uuid) from public;
revoke all on function public.mark_batch_processing(uuid, uuid, integer) from public;
revoke all on function public.record_batch_document_processed(uuid, uuid, boolean, text) from public;

grant execute on function public.create_migration_batch(uuid, text) to authenticated;
grant execute on function public.record_batch_ingest_item(uuid, uuid, text, text, uuid, bigint, public.batch_item_outcome, text) to authenticated;
grant execute on function public.finalize_batch_ingest(uuid, uuid) to authenticated;
grant execute on function public.mark_batch_processing(uuid, uuid, integer) to authenticated;
grant execute on function public.record_batch_document_processed(uuid, uuid, boolean, text) to authenticated;
