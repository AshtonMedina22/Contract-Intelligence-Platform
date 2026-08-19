-- Phase 2 follow-up: atomic org bootstrap, same-org foreign keys,
-- and fail-closed storage path parsing. No intake/OCR/AI.

-- ---------------------------------------------------------------------------
-- Atomic organization + first admin membership
-- ---------------------------------------------------------------------------

create or replace function public.create_organization_with_admin(org_name text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if org_name is null or length(btrim(org_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name)
  values (btrim(org_name))
  returning id into new_id;

  insert into public.memberships (organization_id, user_id, role)
  values (new_id, uid, 'admin');

  return new_id;
end;
$$;

revoke all on function public.create_organization_with_admin(text) from public;
revoke all on function public.create_organization_with_admin(text) from anon;
grant execute on function public.create_organization_with_admin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Same-organization relationship integrity
-- Parent unique (id, organization_id) so composite FKs can enforce tenant match.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_id_organization_id_key'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'opportunities_id_organization_id_key'
      and conrelid = 'public.opportunities'::regclass
  ) then
    alter table public.opportunities
      add constraint opportunities_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_batches_id_organization_id_key'
      and conrelid = 'public.document_batches'::regclass
  ) then
    alter table public.document_batches
      add constraint document_batches_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_id_organization_id_key'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_versions_id_organization_id_key'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions
      add constraint document_versions_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extraction_runs_id_organization_id_key'
      and conrelid = 'public.extraction_runs'::regclass
  ) then
    alter table public.extraction_runs
      add constraint extraction_runs_id_organization_id_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_id_organization_id_key'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts
      add constraint extracted_facts_id_organization_id_key unique (id, organization_id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'opportunities_client_id_fkey'
      and conrelid = 'public.opportunities'::regclass
  ) then
    alter table public.opportunities drop constraint opportunities_client_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'opportunities_client_same_org_fkey'
      and conrelid = 'public.opportunities'::regclass
  ) then
    alter table public.opportunities
      add constraint opportunities_client_same_org_fkey
      foreign key (client_id, organization_id)
      references public.clients (id, organization_id)
      on delete set null;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'documents_batch_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents drop constraint documents_batch_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'documents_client_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents drop constraint documents_client_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'documents_opportunity_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents drop constraint documents_opportunity_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_batch_same_org_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_batch_same_org_fkey
      foreign key (batch_id, organization_id)
      references public.document_batches (id, organization_id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_client_same_org_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_client_same_org_fkey
      foreign key (client_id, organization_id)
      references public.clients (id, organization_id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_opportunity_same_org_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_opportunity_same_org_fkey
      foreign key (opportunity_id, organization_id)
      references public.opportunities (id, organization_id)
      on delete set null;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'document_versions_document_id_fkey'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions drop constraint document_versions_document_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_versions_document_same_org_fkey'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions
      add constraint document_versions_document_same_org_fkey
      foreign key (document_id, organization_id)
      references public.documents (id, organization_id)
      on delete cascade;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'extraction_runs_document_version_id_fkey'
      and conrelid = 'public.extraction_runs'::regclass
  ) then
    alter table public.extraction_runs drop constraint extraction_runs_document_version_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extraction_runs_version_same_org_fkey'
      and conrelid = 'public.extraction_runs'::regclass
  ) then
    alter table public.extraction_runs
      add constraint extraction_runs_version_same_org_fkey
      foreign key (document_version_id, organization_id)
      references public.document_versions (id, organization_id)
      on delete cascade;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_extraction_run_id_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts drop constraint extracted_facts_extraction_run_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_document_id_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts drop constraint extracted_facts_document_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_document_version_id_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts drop constraint extracted_facts_document_version_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_run_same_org_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts
      add constraint extracted_facts_run_same_org_fkey
      foreign key (extraction_run_id, organization_id)
      references public.extraction_runs (id, organization_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_document_same_org_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts
      add constraint extracted_facts_document_same_org_fkey
      foreign key (document_id, organization_id)
      references public.documents (id, organization_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'extracted_facts_version_same_org_fkey'
      and conrelid = 'public.extracted_facts'::regclass
  ) then
    alter table public.extracted_facts
      add constraint extracted_facts_version_same_org_fkey
      foreign key (document_version_id, organization_id)
      references public.document_versions (id, organization_id)
      on delete cascade;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'source_evidence_extracted_fact_id_fkey'
      and conrelid = 'public.source_evidence'::regclass
  ) then
    alter table public.source_evidence drop constraint source_evidence_extracted_fact_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'source_evidence_document_version_id_fkey'
      and conrelid = 'public.source_evidence'::regclass
  ) then
    alter table public.source_evidence drop constraint source_evidence_document_version_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'source_evidence_fact_same_org_fkey'
      and conrelid = 'public.source_evidence'::regclass
  ) then
    alter table public.source_evidence
      add constraint source_evidence_fact_same_org_fkey
      foreign key (extracted_fact_id, organization_id)
      references public.extracted_facts (id, organization_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'source_evidence_version_same_org_fkey'
      and conrelid = 'public.source_evidence'::regclass
  ) then
    alter table public.source_evidence
      add constraint source_evidence_version_same_org_fkey
      foreign key (document_version_id, organization_id)
      references public.document_versions (id, organization_id)
      on delete cascade;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'verification_events_extracted_fact_id_fkey'
      and conrelid = 'public.verification_events'::regclass
  ) then
    alter table public.verification_events drop constraint verification_events_extracted_fact_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_events_fact_same_org_fkey'
      and conrelid = 'public.verification_events'::regclass
  ) then
    alter table public.verification_events
      add constraint verification_events_fact_same_org_fkey
      foreign key (extracted_fact_id, organization_id)
      references public.extracted_facts (id, organization_id)
      on delete set null;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'validation_exceptions_document_id_fkey'
      and conrelid = 'public.validation_exceptions'::regclass
  ) then
    alter table public.validation_exceptions drop constraint validation_exceptions_document_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'validation_exceptions_document_same_org_fkey'
      and conrelid = 'public.validation_exceptions'::regclass
  ) then
    alter table public.validation_exceptions
      add constraint validation_exceptions_document_same_org_fkey
      foreign key (document_id, organization_id)
      references public.documents (id, organization_id)
      on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: parse org UUID fail-closed instead of casting invalid segments
-- ---------------------------------------------------------------------------

create or replace function public.storage_path_org_id(object_name text)
returns uuid
language plpgsql
stable
security invoker
set search_path = public, storage
as $$
declare
  first_segment text;
begin
  if object_name is null or btrim(object_name) = '' then
    return null;
  end if;

  first_segment := (storage.foldername(object_name))[1];

  if first_segment is null then
    return null;
  end if;

  if first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return first_segment::uuid;
end;
$$;

revoke all on function public.storage_path_org_id(text) from public;
revoke all on function public.storage_path_org_id(text) from anon;
grant execute on function public.storage_path_org_id(text) to authenticated;

drop policy if exists intake_select on storage.objects;
drop policy if exists intake_insert on storage.objects;
drop policy if exists evidence_select on storage.objects;
drop policy if exists evidence_insert on storage.objects;

create policy intake_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intake'
    and public.is_org_member(public.storage_path_org_id(name))
  );

create policy intake_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'intake'
    and public.is_org_member(public.storage_path_org_id(name))
  );

create policy evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_member(public.storage_path_org_id(name))
  );

create policy evidence_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_org_member(public.storage_path_org_id(name))
  );
