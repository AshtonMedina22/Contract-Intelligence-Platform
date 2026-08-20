-- Phase 3: document intake registry helpers. No OCR/parser. No canonical promotion.

alter table public.documents
  add column if not exists workflow_run_id text,
  add column if not exists lifecycle_error text;

comment on column public.documents.workflow_run_id is
  'Vercel Workflow run id (or inline: fallback) started after a successful evidence register.';
comment on column public.documents.lifecycle_error is
  'Last non-fatal lifecycle/start error. AI completion must never imply VERIFIED.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_versions_sha256_hex_check'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions
      add constraint document_versions_sha256_hex_check
      check (sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $$;

create or replace function public.register_ingested_document(
  p_organization_id uuid,
  p_document_id uuid,
  p_version_id uuid,
  p_batch_id uuid,
  p_batch_label text,
  p_client_id uuid,
  p_opportunity_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_sha256 text,
  p_storage_path text,
  p_byte_size bigint,
  p_source_drive_file_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.document_versions%rowtype;
  new_batch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'not an organization member';
  end if;

  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 must be 64 lowercase hex characters';
  end if;

  select *
    into existing
  from public.document_versions
  where organization_id = p_organization_id
    and sha256 = p_sha256;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'document_id', existing.document_id,
      'document_version_id', existing.id,
      'storage_path', existing.storage_path,
      'batch_id', null
    );
  end if;

  new_batch_id := coalesce(p_batch_id, gen_random_uuid());

  if p_batch_id is null then
    insert into public.document_batches (id, organization_id, label, created_by)
    values (new_batch_id, p_organization_id, p_batch_label, auth.uid());
  else
    if not exists (
      select 1
      from public.document_batches b
      where b.id = p_batch_id
        and b.organization_id = p_organization_id
    ) then
      raise exception 'batch does not belong to organization';
    end if;
  end if;

  insert into public.documents (
    id,
    organization_id,
    batch_id,
    client_id,
    opportunity_id,
    original_filename,
    mime_type,
    processing_status,
    created_by
  ) values (
    p_document_id,
    p_organization_id,
    new_batch_id,
    p_client_id,
    p_opportunity_id,
    p_original_filename,
    p_mime_type,
    'UPLOADED',
    auth.uid()
  );

  insert into public.document_versions (
    id,
    organization_id,
    document_id,
    version_number,
    sha256,
    storage_bucket,
    storage_path,
    source_drive_file_id,
    byte_size,
    is_current
  ) values (
    p_version_id,
    p_organization_id,
    p_document_id,
    1,
    p_sha256,
    'evidence',
    p_storage_path,
    p_source_drive_file_id,
    p_byte_size,
    true
  );

  return jsonb_build_object(
    'duplicate', false,
    'document_id', p_document_id,
    'document_version_id', p_version_id,
    'storage_path', p_storage_path,
    'batch_id', new_batch_id
  );

exception
  when unique_violation then
    select *
      into existing
    from public.document_versions
    where organization_id = p_organization_id
      and sha256 = p_sha256;

    if not found then
      raise;
    end if;

    return jsonb_build_object(
      'duplicate', true,
      'document_id', existing.document_id,
      'document_version_id', existing.id,
      'storage_path', existing.storage_path,
      'batch_id', null
    );
end;
$$;

revoke all on function public.register_ingested_document(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, bigint, text
) from public;
revoke all on function public.register_ingested_document(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, bigint, text
) from anon;
grant execute on function public.register_ingested_document(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, bigint, text
) to authenticated;
