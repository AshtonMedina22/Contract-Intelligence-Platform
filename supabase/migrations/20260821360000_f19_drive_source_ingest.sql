-- F19: Google Drive / Workspace SOURCE ingestion.
-- Drive is a selective human workspace; Supabase Storage remains the evidence vault.
-- This is intentionally separate from F8 WORKING_PROPOSAL_OUTPUT.

create table if not exists public.document_source_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  provider text not null,
  direction text not null default 'SOURCE_INGEST',
  upstream_file_id text not null,
  mime text,
  modified timestamptz,
  availability text not null default 'AVAILABLE',
  last_synced_at timestamptz not null default now(),
  last_sha256 text,
  folder_id text,
  export_format text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, provider, direction, upstream_file_id),
  constraint document_source_links_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete restrict,
  constraint document_source_links_provider_check
    check (provider in ('google_drive', 'local_upload')),
  constraint document_source_links_direction_check
    check (direction = 'SOURCE_INGEST'),
  constraint document_source_links_availability_check
    check (availability in ('AVAILABLE', 'UNAVAILABLE', 'ERROR')),
  constraint document_source_links_export_format_check
    check (export_format is null or export_format in ('pdf', 'docx', 'xlsx')),
  constraint document_source_links_upstream_file_id_present
    check (length(btrim(upstream_file_id)) > 0),
  constraint document_source_links_sha256_format
    check (last_sha256 is null or last_sha256 ~ '^[a-f0-9]{64}$')
);

create index if not exists document_source_links_org_document_idx
  on public.document_source_links (organization_id, document_id);
create index if not exists document_source_links_org_folder_idx
  on public.document_source_links (organization_id, provider, folder_id)
  where folder_id is not null;
create index if not exists document_source_links_sync_idx
  on public.document_source_links (organization_id, availability, last_synced_at desc);

comment on table public.document_source_links is
  'F19 selective external SOURCE links. Canonical bytes live in the append-only Supabase Storage evidence vault.';
comment on column public.document_source_links.direction is
  'SOURCE_INGEST only. F8 Google Docs WORKING_PROPOSAL_OUTPUT is a separate provider/module.';
comment on column public.document_source_links.availability is
  'Upstream availability only. UNAVAILABLE never deletes document_versions or Storage evidence.';
comment on column public.document_source_links.metadata is
  'Non-secret provider metadata (name, parents, checksum hints, web URL). Never store OAuth tokens.';

alter table public.document_source_links enable row level security;

drop policy if exists document_source_links_select on public.document_source_links;
create policy document_source_links_select on public.document_source_links
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists document_source_links_insert on public.document_source_links;
create policy document_source_links_insert on public.document_source_links
  for insert to authenticated
  with check (
    public.has_org_role(
      organization_id,
      array['admin', 'importer', 'verifier']::public.membership_role[]
    )
  );

drop policy if exists document_source_links_update on public.document_source_links;
create policy document_source_links_update on public.document_source_links
  for update to authenticated
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'importer', 'verifier']::public.membership_role[]
    )
  )
  with check (
    public.has_org_role(
      organization_id,
      array['admin', 'importer', 'verifier']::public.membership_role[]
    )
  );

-- Links are retained as provenance. Upstream removal changes availability; it does not DELETE.
revoke all on public.document_source_links from anon;
grant select, insert, update on public.document_source_links to authenticated, service_role;
revoke delete on public.document_source_links from authenticated;
