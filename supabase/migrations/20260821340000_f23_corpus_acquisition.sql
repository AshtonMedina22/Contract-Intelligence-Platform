-- F23: Public Procurement Corpus Acquisition + Intelligence Enrichment Engine
--
-- Thin acquisition_candidates registry → F1 vault intake (AI_EXTRACTED only).
-- Never auto HUMAN_VERIFIED. Never fabricate sources. Authority 3 = discovery lead only.
-- No second scheduler — idempotent CLI; F9 may later cue refresh via same intelligence cron.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.acquisition_corpus_role as enum (
    'L_AND_P_DIRECT',
    'BUYER_HISTORY',
    'COMPETITOR_EVIDENCE',
    'COMPARABLE_SECURITY',
    'REFERENCE_DATA'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.acquisition_corpus_role is
  'F23 corpus role. Ambiguous seeds must NOT be L_AND_P_DIRECT. Competitor history never labeled as L&P.';

do $$
begin
  create type public.acquisition_candidate_status as enum (
    'DISCOVERED',
    'QUEUED',
    'ACQUIRED',
    'DUPLICATE',
    'INGESTED',
    'REVIEW_READY',
    'MANUAL_IMPORT',
    'LINK_ONLY',
    'REJECTED',
    'FAILED'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.acquisition_candidate_status is
  'Acquisition lifecycle. LINK_ONLY/MANUAL_IMPORT are honest non-download outcomes.';

-- ---------------------------------------------------------------------------
-- acquisition_candidates
-- ---------------------------------------------------------------------------

create table if not exists public.acquisition_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  corpus_role public.acquisition_corpus_role not null,
  source_authority smallint not null,
  url text not null,
  url_hash text not null,
  title text,
  buyer_name text,
  solicitation_number text,
  solicitation_hints jsonb not null default '{}'::jsonb,
  status public.acquisition_candidate_status not null default 'DISCOVERED',
  sha256 text,
  document_id uuid,
  package_key text,
  local_path text,
  byte_size bigint,
  content_type text,
  retrieved_at timestamptz,
  last_error text,
  -- Queries / saturation attempts for this candidate (honest log; never fabricated hits)
  search_log jsonb not null default '[]'::jsonb,
  seed_section text,
  seed_id text,
  provider text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, url_hash),
  constraint acquisition_candidates_url_present check (length(btrim(url)) > 0),
  constraint acquisition_candidates_authority_range check (source_authority in (1, 2, 3)),
  constraint acquisition_candidates_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint acquisition_candidates_sha256_format check (
    sha256 is null or sha256 ~ '^[a-f0-9]{64}$'
  )
);

create index if not exists acquisition_candidates_org_status_idx
  on public.acquisition_candidates (organization_id, status);

create index if not exists acquisition_candidates_org_role_idx
  on public.acquisition_candidates (organization_id, corpus_role);

create index if not exists acquisition_candidates_org_sha_idx
  on public.acquisition_candidates (organization_id, sha256)
  where sha256 is not null;

create index if not exists acquisition_candidates_package_key_idx
  on public.acquisition_candidates (organization_id, package_key)
  where package_key is not null;

comment on table public.acquisition_candidates is
  'F23 public corpus acquisition registry. Downloads checksum locally then F1 vault ingest as AI_EXTRACTED only.';
comment on column public.acquisition_candidates.source_authority is
  '1=primary official document; 2=secondary official/open-data; 3=news/search discovery lead until primary found.';
comment on column public.acquisition_candidates.search_log is
  'JSON array of {query, provider, attempted_at, result_count, note} — saturation honesty.';
comment on column public.acquisition_candidates.document_id is
  'Set only after F1 register_ingested_document. Never implies HUMAN_VERIFIED.';

-- ---------------------------------------------------------------------------
-- acquisition_saturation_runs — org-level search saturation log
-- ---------------------------------------------------------------------------

create table if not exists public.acquisition_saturation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  query text not null,
  buyer_or_entity text,
  result_count integer,
  mode text not null default 'live',
  notes text,
  raw_summary jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint acquisition_saturation_runs_query_present check (length(btrim(query)) > 0),
  constraint acquisition_saturation_runs_provider_present check (length(btrim(provider)) > 0)
);

create index if not exists acquisition_saturation_runs_org_idx
  on public.acquisition_saturation_runs (organization_id, attempted_at desc);

create index if not exists acquisition_saturation_runs_provider_idx
  on public.acquisition_saturation_runs (organization_id, provider);

comment on table public.acquisition_saturation_runs is
  'Honest F23 search saturation log (USAspending/SAM/Socrata/web). Never invents hits.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.acquisition_candidates enable row level security;
alter table public.acquisition_saturation_runs enable row level security;

drop policy if exists acquisition_candidates_select on public.acquisition_candidates;
create policy acquisition_candidates_select on public.acquisition_candidates
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists acquisition_candidates_insert on public.acquisition_candidates;
create policy acquisition_candidates_insert on public.acquisition_candidates
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists acquisition_candidates_update on public.acquisition_candidates;
create policy acquisition_candidates_update on public.acquisition_candidates
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists acquisition_candidates_delete on public.acquisition_candidates;
create policy acquisition_candidates_delete on public.acquisition_candidates
  for delete to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists acquisition_saturation_runs_select on public.acquisition_saturation_runs;
create policy acquisition_saturation_runs_select on public.acquisition_saturation_runs
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists acquisition_saturation_runs_insert on public.acquisition_saturation_runs;
create policy acquisition_saturation_runs_insert on public.acquisition_saturation_runs
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists acquisition_saturation_runs_update on public.acquisition_saturation_runs;
create policy acquisition_saturation_runs_update on public.acquisition_saturation_runs
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists acquisition_saturation_runs_delete on public.acquisition_saturation_runs;
create policy acquisition_saturation_runs_delete on public.acquisition_saturation_runs
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.acquisition_candidates to authenticated, service_role;
grant select, insert, update, delete on public.acquisition_saturation_runs to authenticated, service_role;
