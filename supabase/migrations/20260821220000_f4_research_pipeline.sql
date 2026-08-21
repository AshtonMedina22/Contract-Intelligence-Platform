-- F4: Public Research Acquisition + Verified Research Fact Pipeline
--
-- Durable research_runs / research_sources feed research_facts as AI_EXTRACTED only.
-- Public ≠ NEVER auto-promote to HUMAN_VERIFIED. The existing
-- research_facts_verified_requires_actor check is preserved and not weakened.

create type public.research_type as enum (
  'BUYER',
  'COMPETITOR',
  'MARKET',
  'PURSUIT',
  'RECOMPETE',
  'PRICING_CONTEXT'
);

create type public.research_run_status as enum (
  'QUEUED',
  'RESEARCHING',
  'REVIEW_READY',
  'VERIFIED',
  'REJECTED',
  'FAILED'
);

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  research_type public.research_type not null,
  status public.research_run_status not null default 'QUEUED',
  query text not null,
  purpose text,
  plan jsonb not null default '{"subquestions":[]}'::jsonb,
  client_id uuid,
  competitor_id uuid,
  opportunity_id uuid,
  contract_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  unique (id, organization_id),
  constraint research_runs_query_present check (length(btrim(query)) > 0),
  constraint research_runs_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint research_runs_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete set null,
  constraint research_runs_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint research_runs_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null
);

create index research_runs_organization_id_idx on public.research_runs (organization_id);
create index research_runs_status_idx on public.research_runs (organization_id, status);
create index research_runs_type_idx on public.research_runs (organization_id, research_type);

comment on table public.research_runs is
  'Bounded public research acquisition runs. Results stay AI_EXTRACTED until a human verifies each fact — never auto HUMAN_VERIFIED.';
comment on column public.research_runs.plan is
  'Deterministic subquestions JSON: { "subquestions": [{ "id", "text", "provider_hint" }] }.';
comment on column public.research_runs.status is
  'QUEUED → RESEARCHING → REVIEW_READY | FAILED; after human review of all facts → VERIFIED | REJECTED.';

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  research_run_id uuid not null,
  url text not null,
  url_hash text not null,
  title text,
  publisher text,
  domain text,
  retrieved_at timestamptz not null default now(),
  published_on date,
  source_type text not null default 'web',
  excerpt text,
  content_hash text,
  provider text not null,
  external_id text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (research_run_id, url),
  constraint research_sources_url_present check (length(btrim(url)) > 0),
  constraint research_sources_provider_present check (length(btrim(provider)) > 0),
  constraint research_sources_run_same_org_fkey
    foreign key (research_run_id, organization_id)
    references public.research_runs (id, organization_id)
    on delete cascade
);

create index research_sources_organization_id_idx on public.research_sources (organization_id);
create index research_sources_run_id_idx on public.research_sources (research_run_id);
create index research_sources_org_url_hash_idx on public.research_sources (organization_id, url_hash);

comment on table public.research_sources is
  'Captured public URLs for a research run. Dedupe within a run by url; never delete historical sources on refresh.';
comment on column public.research_sources.provider is
  'Adapter that produced the hit: tavily | brave | usa_spending | manual | … Fixtures (FIXTURE-*) must never persist.';

-- Extend research_facts for run/source lineage. claim maps to title when claim is null.
-- research_facts_verified_requires_actor is intentionally untouched.
alter table public.research_facts
  add column if not exists research_run_id uuid,
  add column if not exists research_source_id uuid,
  add column if not exists claim text,
  add column if not exists confidence numeric(5, 4);

alter table public.research_facts
  drop constraint if exists research_facts_run_same_org_fkey;
alter table public.research_facts
  add constraint research_facts_run_same_org_fkey
  foreign key (research_run_id, organization_id)
  references public.research_runs (id, organization_id)
  on delete set null;

alter table public.research_facts
  drop constraint if exists research_facts_source_same_org_fkey;
alter table public.research_facts
  add constraint research_facts_source_same_org_fkey
  foreign key (research_source_id, organization_id)
  references public.research_sources (id, organization_id)
  on delete set null;

alter table public.research_facts
  drop constraint if exists research_facts_confidence_range;
alter table public.research_facts
  add constraint research_facts_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 1));

create index if not exists research_facts_run_id_idx on public.research_facts (research_run_id);
create index if not exists research_facts_source_id_idx on public.research_facts (research_source_id);

comment on column public.research_facts.claim is
  'Atomic claim text. When null, title is the claim (title/excerpt already existed before F4).';
comment on column public.research_facts.confidence is
  'Optional extractor confidence 0–1. Never implies HUMAN_VERIFIED.';
comment on column public.research_facts.research_run_id is
  'Owning F4 research run when the fact was acquired via public research.';
comment on column public.research_facts.research_source_id is
  'Source row that produced this fact.';

-- Optional audit linkage for research-fact review (extracted_fact_id remains for document facts).
alter table public.verification_events
  add column if not exists research_fact_id uuid;

alter table public.verification_events
  drop constraint if exists verification_events_research_fact_same_org_fkey;
alter table public.verification_events
  add constraint verification_events_research_fact_same_org_fkey
  foreign key (research_fact_id, organization_id)
  references public.research_facts (id, organization_id)
  on delete set null;

create index if not exists verification_events_research_fact_id_idx
  on public.verification_events (research_fact_id)
  where research_fact_id is not null;

comment on column public.verification_events.research_fact_id is
  'When set, this audit event belongs to a research_facts review action (verify/reject/edit/conflict).';

-- RLS
alter table public.research_runs enable row level security;
alter table public.research_sources enable row level security;

create policy research_runs_all on public.research_runs
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy research_sources_all on public.research_sources
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.research_runs to authenticated;
grant select, insert, update, delete on public.research_sources to authenticated;

-- Defense in depth: assert the verified-requires-actor constraint still exists.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'research_facts_verified_requires_actor'
      and conrelid = 'public.research_facts'::regclass
  ) then
    raise exception 'research_facts_verified_requires_actor missing — refusing to proceed';
  end if;
end $$;
