-- F16: Texas / State / Local Procurement Source Connectors
-- Extends F2/P4 public_sources with capability metadata, addendum refresh cues,
-- soft cross-source dedupe, and source health. Never invents awards; never auto
-- HUMAN_VERIFIED; sync still fails closed for fixture/non-AUTOMATED providers.

-- ---------------------------------------------------------------------------
-- Widen public_sources.provider check
-- ---------------------------------------------------------------------------

alter table public.public_sources
  drop constraint if exists public_sources_provider_check;

alter table public.public_sources
  add constraint public_sources_provider_check check (
    provider in (
      'sam_gov',
      'fixture',
      'manual',
      'usa_spending',
      'state',
      'local',
      'texas_esbd',
      'socrata',
      'rss',
      'json_feed',
      'html_listing'
    )
  );

comment on column public.public_sources.provider is
  'Adapter that produced the record: sam_gov | fixture | manual | usa_spending | state | local | texas_esbd | socrata | rss | json_feed | html_listing.';

-- ---------------------------------------------------------------------------
-- Capability + change / addendum cues + soft dedupe + health
-- ---------------------------------------------------------------------------

alter table public.public_sources
  add column if not exists capability text,
  add column if not exists content_changed_at timestamptz,
  add column if not exists addendum_refresh_needed boolean not null default false,
  add column if not exists duplicate_of_id uuid,
  add column if not exists source_health jsonb;

alter table public.public_sources
  drop constraint if exists public_sources_capability_check;

alter table public.public_sources
  add constraint public_sources_capability_check check (
    capability is null
    or capability in ('AUTOMATED', 'MANUAL_IMPORT', 'LINK_ONLY')
  );

comment on column public.public_sources.capability is
  'Honest retrieval capability of the adapter that last wrote this row: AUTOMATED | MANUAL_IMPORT | LINK_ONLY.';
comment on column public.public_sources.content_changed_at is
  'Set when sync detects a content_hash change on an existing row. Operator cue only — does not invent awards.';
comment on column public.public_sources.addendum_refresh_needed is
  'True when a WATCHING/CONVERTED/REVIEWING notice listing changed on sync. Cue to ingest addendum via Data Ops / F11 — never auto-creates F11 runs.';
comment on column public.public_sources.duplicate_of_id is
  'Soft cross-source duplicate hint (same solicitation_number + buyer). Nullable; never hard-merges or invents rows.';
comment on column public.public_sources.source_health is
  'Last provider health snapshot (ok, mode, capability, message, httpStatus, checked_at).';

-- Soft FK: duplicate stays in same org; restrict delete of the canonical tip.
alter table public.public_sources
  drop constraint if exists public_sources_duplicate_of_same_org_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'public_sources_duplicate_of_same_org_fkey'
  ) then
    alter table public.public_sources
      add constraint public_sources_duplicate_of_same_org_fkey
      foreign key (duplicate_of_id, organization_id)
      references public.public_sources (id, organization_id)
      on delete set null;
  end if;
exception
  when others then
    -- If composite FK cannot be added (missing unique), leave column unconstrained;
    -- application still treats duplicate_of_id as a soft hint.
    raise notice 'public_sources soft duplicate FK skipped: %', SQLERRM;
end $$;

create index if not exists public_sources_addendum_refresh_idx
  on public.public_sources (organization_id, addendum_refresh_needed)
  where addendum_refresh_needed = true;

create index if not exists public_sources_capability_idx
  on public.public_sources (organization_id, capability);

-- ---------------------------------------------------------------------------
-- opportunity_search_profiles: agency / source criteria + health
-- Reuse existing profiles; criteria jsonb may include provider, socrata,
-- rssUrl, jsonFeedUrl, agencyType (ISD/city/county), portalUrl, capability.
-- ---------------------------------------------------------------------------

alter table public.opportunity_search_profiles
  add column if not exists source_health jsonb;

comment on column public.opportunity_search_profiles.criteria is
  'JSON search criteria. F2 fields: keywords, naics, set_aside, state, buyer, postedFrom, postedTo, dueWithinDays, limit. F16 agency/source: provider, capability, agencyType, portalUrl, socrata {domain,datasetId,fieldMap}, rssUrl, jsonFeedUrl.';
comment on column public.opportunity_search_profiles.source_health is
  'Last sync health snapshot for this profile (per-provider ok/mode/capability/message).';
