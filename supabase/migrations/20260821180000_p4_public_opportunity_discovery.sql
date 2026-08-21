-- P4 productization: public opportunity discovery + watchlist + start pursuit.
--
-- `public_sources` holds externally retrieved procurement notices (SAM.gov, fixtures, manual
-- research, USAspending, state/local portals). These are EXTERNAL PUBLIC RECORDS, not L&P
-- canonical truth: rows only land here when an operator watches or starts a pursuit, and any
-- derived research_facts stay AI_EXTRACTED until a human verifies them.

create table public.public_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  external_id text not null,
  source_url text,
  title text not null,
  buyer_name text,
  solicitation_number text,
  procurement_type text,
  posted_on date,
  due_on date,
  naics text,
  psc text,
  set_aside text,
  geography text,
  estimated_value numeric(16, 2),
  raw_payload jsonb,
  retrieved_at timestamptz not null default now(),
  watchlisted_at timestamptz,
  dismissed_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, provider, external_id),
  constraint public_sources_provider_check check (
    provider in ('sam_gov', 'fixture', 'manual', 'usa_spending', 'state', 'local')
  ),
  constraint public_sources_title_present check (length(btrim(title)) > 0),
  constraint public_sources_external_id_present check (length(btrim(external_id)) > 0)
);

create index public_sources_organization_id_idx on public.public_sources (organization_id);
create index public_sources_watchlist_idx
  on public.public_sources (organization_id, watchlisted_at)
  where watchlisted_at is not null and dismissed_at is null;
create index public_sources_due_idx on public.public_sources (organization_id, due_on);

comment on table public.public_sources is
  'Externally retrieved public procurement notices. Public record only — never canonical L&P truth and never auto-promoted to HUMAN_VERIFIED.';
comment on column public.public_sources.provider is
  'Adapter that produced the record: sam_gov | fixture | manual | usa_spending | state | local.';
comment on column public.public_sources.external_id is
  'Provider-native notice id. Fixture rows use clearly labeled FIXTURE-* ids and are sample data, not live notices.';
comment on column public.public_sources.estimated_value is
  'Only populated when the provider itself supplies an amount. Never inferred or estimated by us.';
comment on column public.public_sources.raw_payload is
  'Verbatim provider payload kept for provenance and re-normalization.';
comment on column public.public_sources.watchlisted_at is
  'Set when an operator explicitly watches the notice. Discovery results are not persisted without this or a started pursuit.';

alter table public.public_sources enable row level security;

create policy public_sources_select on public.public_sources
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy public_sources_insert on public.public_sources
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy public_sources_update on public.public_sources
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy public_sources_delete on public.public_sources
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.public_sources to authenticated;

-- Pursuit provenance back to the public notice it started from.
alter table public.opportunities
  add column if not exists external_provider text,
  add column if not exists external_source_id text,
  add column if not exists source_url text,
  add column if not exists public_source_id uuid;

-- Composite FK keeps the notice in the same tenant as the pursuit. `restrict` rather than
-- `set null`: a pursuit's public provenance must not be silently severed, and nulling the pair
-- would also null the NOT NULL organization_id. Operators dismiss notices, they do not delete them.
alter table public.opportunities
  drop constraint if exists opportunities_public_source_same_org_fkey;
alter table public.opportunities
  add constraint opportunities_public_source_same_org_fkey
  foreign key (public_source_id, organization_id)
  references public.public_sources (id, organization_id)
  on delete restrict;

create unique index if not exists opportunities_external_source_uidx
  on public.opportunities (organization_id, external_provider, external_source_id)
  where external_provider is not null and external_source_id is not null;

comment on column public.opportunities.external_provider is
  'Public discovery adapter this pursuit was started from. Null for operator-created pursuits.';
comment on column public.opportunities.external_source_id is
  'Provider-native notice id this pursuit was started from.';
comment on column public.opportunities.source_url is
  'Public notice URL. Provenance only — the solicitation still has to be ingested and verified.';

-- Provider provenance on public research evidence.
alter table public.research_facts
  add column if not exists provider text,
  add column if not exists external_id text;

comment on column public.research_facts.provider is
  'Public discovery adapter that produced this fact (sam_gov, fixture, manual, ...). Null for document-derived facts.';
comment on column public.research_facts.external_id is
  'Provider-native id for the record this fact came from.';
