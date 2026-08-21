-- F2: Public Procurement Opportunity Discovery Engine
-- Extends P4 public_sources with an explicit status model + content hash, and adds
-- org-scoped search profiles for scheduled sync. Sync never invents notices — it only
-- upserts what a provider returned.

-- ---------------------------------------------------------------------------
-- public_sources.status + content_hash
-- ---------------------------------------------------------------------------

alter table public.public_sources
  add column if not exists status text,
  add column if not exists content_hash text;

comment on column public.public_sources.status is
  'Operator lifecycle for a persisted public notice: NEW | WATCHING | DISMISSED | REVIEWING | CONVERTED_TO_PURSUIT | CLOSED. Distinct from opportunity stage.';
comment on column public.public_sources.content_hash is
  'Stable hash of normalized notice fields for change detection on sync upsert. Null until first hash computation.';

-- Backfill from existing watch/dismiss/pursuit signals before enforcing NOT NULL.
update public.public_sources ps
set status = 'DISMISSED'
where status is null
  and dismissed_at is not null;

update public.public_sources ps
set status = 'CONVERTED_TO_PURSUIT'
where status is null
  and exists (
    select 1
    from public.opportunities o
    where o.public_source_id = ps.id
      and o.organization_id = ps.organization_id
  );

update public.public_sources ps
set status = 'WATCHING'
where status is null
  and watchlisted_at is not null;

update public.public_sources ps
set status = 'CLOSED'
where status is null
  and due_on is not null
  and due_on < (timezone('utc', now()))::date;

update public.public_sources
set status = 'NEW'
where status is null;

alter table public.public_sources
  alter column status set default 'NEW';

alter table public.public_sources
  alter column status set not null;

alter table public.public_sources
  drop constraint if exists public_sources_status_check;

alter table public.public_sources
  add constraint public_sources_status_check check (
    status in (
      'NEW',
      'WATCHING',
      'DISMISSED',
      'REVIEWING',
      'CONVERTED_TO_PURSUIT',
      'CLOSED'
    )
  );

create index if not exists public_sources_status_idx
  on public.public_sources (organization_id, status);

-- ---------------------------------------------------------------------------
-- opportunity_search_profiles (org-scoped sync criteria)
-- ---------------------------------------------------------------------------

create table if not exists public.opportunity_search_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  criteria jsonb not null default '{}'::jsonb,
  schedule_cron text,
  last_run_at timestamptz,
  last_error text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  constraint opportunity_search_profiles_name_present check (length(btrim(name)) > 0)
);

comment on table public.opportunity_search_profiles is
  'Org-scoped public opportunity search profiles. Cron/sync runs enabled profiles against PublicProcurementProvider.search and upserts public_sources — never invents notices.';
comment on column public.opportunity_search_profiles.criteria is
  'JSON search criteria (keywords, naics, set_aside, state, buyer, postedFrom, postedTo, dueWithinDays, limit). Mapped to PublicOpportunityQuery.';
comment on column public.opportunity_search_profiles.schedule_cron is
  'Optional cron expression for documentation/ops. Vercel cron entry is bounded (daily); this field does not by itself schedule runs.';

create index if not exists opportunity_search_profiles_org_idx
  on public.opportunity_search_profiles (organization_id);
create index if not exists opportunity_search_profiles_enabled_idx
  on public.opportunity_search_profiles (organization_id, enabled)
  where enabled = true;

alter table public.opportunity_search_profiles enable row level security;

drop policy if exists opportunity_search_profiles_select on public.opportunity_search_profiles;
create policy opportunity_search_profiles_select on public.opportunity_search_profiles
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists opportunity_search_profiles_insert on public.opportunity_search_profiles;
create policy opportunity_search_profiles_insert on public.opportunity_search_profiles
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists opportunity_search_profiles_update on public.opportunity_search_profiles;
create policy opportunity_search_profiles_update on public.opportunity_search_profiles
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists opportunity_search_profiles_delete on public.opportunity_search_profiles;
create policy opportunity_search_profiles_delete on public.opportunity_search_profiles
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.opportunity_search_profiles to authenticated;
