-- Phase 2: tenancy, document registry, staging/provenance, RLS, storage policies.
-- No intake UI. No OCR. Canonical promotion of domain contracts/pricing is later.

create extension if not exists pgcrypto;

create type public.membership_role as enum (
  'admin',
  'importer',
  'verifier',
  'bidder',
  'executive'
);

create type public.document_processing_status as enum (
  'UPLOADED',
  'QUEUED',
  'PARSING',
  'EXTRACTING',
  'VALIDATING',
  'NEEDS_REVIEW',
  'VERIFIED',
  'FAILED'
);

create type public.fact_verification_status as enum (
  'AI_EXTRACTED',
  'NEEDS_REVIEW',
  'HUMAN_VERIFIED',
  'REJECTED',
  'CONFLICT'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'bidder',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_organization_id_idx on public.memberships (organization_id);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = any (allowed)
  );
$$;

create or replace function public.org_member_count(org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.memberships m
  where m.organization_id = org_id;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.has_org_role(uuid, public.membership_role[]) from public;
revoke all on function public.org_member_count(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.membership_role[]) to authenticated;
grant execute on function public.org_member_count(uuid) to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_organization_id_idx on public.clients (organization_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_organization_id_idx on public.opportunities (organization_id);
create index opportunities_client_id_idx on public.opportunities (client_id);

create table public.document_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index document_batches_organization_id_idx on public.document_batches (organization_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_id uuid references public.document_batches (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  original_filename text not null,
  mime_type text,
  document_type text,
  processing_status public.document_processing_status not null default 'UPLOADED',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_organization_id_idx on public.documents (organization_id);
create index documents_processing_status_idx on public.documents (organization_id, processing_status);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  version_number integer not null default 1,
  sha256 text not null,
  storage_bucket text not null default 'evidence',
  storage_path text not null,
  source_drive_file_id text,
  byte_size bigint,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (document_id, version_number),
  unique (organization_id, sha256)
);

create index document_versions_document_id_idx on public.document_versions (document_id);

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  parser_id text,
  extractor_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create index extraction_runs_organization_id_idx on public.extraction_runs (organization_id);

create table public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  extraction_run_id uuid not null references public.extraction_runs (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  entity text,
  field text not null,
  raw_value text,
  normalized_value text,
  normalized_type text,
  source_page integer,
  source_section text,
  source_excerpt text,
  confidence numeric,
  verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  verified_value text,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint extracted_facts_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  )
);

create index extracted_facts_organization_id_idx on public.extracted_facts (organization_id);
create index extracted_facts_status_idx on public.extracted_facts (organization_id, verification_status);
create index extracted_facts_document_id_idx on public.extracted_facts (document_id);

create table public.source_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  extracted_fact_id uuid not null references public.extracted_facts (id) on delete cascade,
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  page integer,
  section text,
  excerpt text,
  bbox jsonb,
  created_at timestamptz not null default now()
);

create index source_evidence_fact_id_idx on public.source_evidence (extracted_fact_id);

create table public.verification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  extracted_fact_id uuid references public.extracted_facts (id) on delete set null,
  actor_id uuid references auth.users (id),
  action text not null,
  from_status public.fact_verification_status,
  to_status public.fact_verification_status,
  note text,
  created_at timestamptz not null default now()
);

create index verification_events_organization_id_idx on public.verification_events (organization_id);

create table public.validation_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  code text not null,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index validation_exceptions_organization_id_idx on public.validation_exceptions (organization_id);

-- RLS
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.opportunities enable row level security;
alter table public.document_batches enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extracted_facts enable row level security;
alter table public.source_evidence enable row level security;
alter table public.verification_events enable row level security;
alter table public.validation_exceptions enable row level security;

-- Organizations: members can read; any authenticated user can create the first org (bootstrap).
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (true);

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- Memberships
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (
      user_id = auth.uid()
      and public.org_member_count(organization_id) = 0
    )
  );

create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- Generic org-scoped tables
create policy clients_all on public.clients
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy opportunities_all on public.opportunities
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy document_batches_all on public.document_batches
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy documents_all on public.documents
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy document_versions_all on public.document_versions
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy extraction_runs_all on public.extraction_runs
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy extracted_facts_all on public.extracted_facts
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy source_evidence_all on public.source_evidence
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy verification_events_all on public.verification_events
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy validation_exceptions_all on public.validation_exceptions
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Storage: private buckets. Path: org_id/document_id/version_id/sha256/original.ext
insert into storage.buckets (id, name, public)
values
  ('intake', 'intake', false),
  ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy intake_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intake'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy intake_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'intake'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Evidence: append-only for normal users. No update/delete.
create policy evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy evidence_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Table privileges (RLS still applies). Authenticated only — not anon.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
