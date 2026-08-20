-- VERIFY 1: Foundation hardening — attributable audit, immutable version identity,
-- append-only provenance rows, one current version, append-version RPC.

alter table public.verification_events
  alter column actor_id set not null;

alter table public.verification_events
  drop constraint if exists verification_events_actor_required;

alter table public.verification_events
  add constraint verification_events_actor_required
  check (actor_id is not null);

create unique index if not exists document_versions_one_current_idx
  on public.document_versions (document_id)
  where is_current;

create or replace function public.protect_document_version_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sha256 is distinct from old.sha256
     or new.storage_path is distinct from old.storage_path
     or new.storage_bucket is distinct from old.storage_bucket
     or new.document_id is distinct from old.document_id
     or new.organization_id is distinct from old.organization_id
     or new.version_number is distinct from old.version_number then
    raise exception 'document version identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_identity_immutable on public.document_versions;
create trigger document_versions_identity_immutable
  before update on public.document_versions
  for each row
  execute procedure public.protect_document_version_identity();

drop policy if exists source_evidence_all on public.source_evidence;
create policy source_evidence_select on public.source_evidence
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy source_evidence_insert on public.source_evidence
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists verification_events_all on public.verification_events;
create policy verification_events_select on public.verification_events
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy verification_events_insert on public.verification_events
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create or replace function public.append_document_version(
  p_organization_id uuid,
  p_document_id uuid,
  p_version_id uuid,
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
  next_number integer;
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
      'version_number', existing.version_number
    );
  end if;

  if not exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and d.organization_id = p_organization_id
  ) then
    raise exception 'document does not belong to organization';
  end if;

  select coalesce(max(v.version_number), 0) + 1
    into next_number
  from public.document_versions v
  where v.document_id = p_document_id
    and v.organization_id = p_organization_id;

  update public.document_versions
     set is_current = false
   where document_id = p_document_id
     and organization_id = p_organization_id
     and is_current;

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
    next_number,
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
    'version_number', next_number
  );
end;
$$;

revoke all on function public.append_document_version(
  uuid, uuid, uuid, text, text, bigint, text
) from public;
revoke all on function public.append_document_version(
  uuid, uuid, uuid, text, text, bigint, text
) from anon;
grant execute on function public.append_document_version(
  uuid, uuid, uuid, text, text, bigint, text
) to authenticated;
