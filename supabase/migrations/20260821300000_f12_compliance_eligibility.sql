-- F12: Corporate Compliance + Government Registration / Eligibility Engine
-- Hard rules (documented + enforced):
--   * AI/extraction CANNOT set HUMAN_VERIFIED (requires verified_by + verified_at).
--   * VERIFIED_AVAILABLE match requires HUMAN_VERIFIED inventory + source evidence.
--   * Missing source ≠ VERIFIED_AVAILABLE.
--   * Do not invent insurance limits; coverage_json is opaque recorded evidence only.
--   * Eligibility is advisory — never a legal determination.
--   * Reuse F9 compliance_expiration via mirrored registration rows — NO second scheduler.
-- BidBridge / ExpiryGuard / OpenContracts = reference patterns only.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.compliance_verification_status as enum (
    'AI_EXTRACTED',
    'PUBLIC_UNVERIFIED',
    'HUMAN_VERIFIED',
    'REJECTED',
    'NEEDS_REVIEW'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.requirement_compliance_match_status as enum (
    'VERIFIED_AVAILABLE',
    'EXPIRING',
    'MISSING',
    'INSUFFICIENT',
    'UNKNOWN',
    'NOT_APPLICABLE'
  );
exception
  when duplicate_object then null;
end $$;

-- Expand compliance_kind (additive; existing values preserved)
do $$
begin
  alter type public.compliance_kind add value if not exists 'registration';
  alter type public.compliance_kind add value if not exists 'personnel_qualification';
  alter type public.compliance_kind add value if not exists 'membership';
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- organization_registrations (UEI / CAGE / SAM / NAICS / PSC)
-- ---------------------------------------------------------------------------
create table if not exists public.organization_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uei text,
  cage text,
  sam_status text,
  sam_expiration_on date,
  naics text[] not null default '{}'::text[],
  psc text[] not null default '{}'::text[],
  vehicles_notes text,
  source_document_id uuid,
  source_document_version_id uuid,
  source_url text,
  source_fact_id uuid,
  verification_status public.compliance_verification_status not null default 'AI_EXTRACTED',
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  supersedes_id uuid,
  as_of date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint organization_registrations_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint organization_registrations_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint organization_registrations_supersedes_same_org_fkey
    foreign key (supersedes_id, organization_id)
    references public.organization_registrations (id, organization_id)
    on delete set null,
  constraint organization_registrations_source_document_version_fkey
    foreign key (source_document_version_id)
    references public.document_versions (id)
    on delete set null,
  -- HUMAN_VERIFIED only via human path (verified_by + verified_at). AI cannot satisfy this.
  constraint organization_registrations_human_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  )
);

create index if not exists organization_registrations_org_idx
  on public.organization_registrations (organization_id, created_at desc);
create index if not exists organization_registrations_verification_idx
  on public.organization_registrations (organization_id, verification_status);
create index if not exists organization_registrations_sam_exp_idx
  on public.organization_registrations (organization_id, sam_expiration_on)
  where sam_expiration_on is not null;

comment on table public.organization_registrations is
  'Org corporate SAM/UEI/CAGE/NAICS/PSC profile. Append + supersedes_id for history. Never fabricate.';
comment on column public.organization_registrations.verification_status is
  'AI_EXTRACTED / PUBLIC_UNVERIFIED until human verify.promote sets HUMAN_VERIFIED with actor.';
comment on column public.organization_registrations.naics is
  'Recorded NAICS codes only — not an eligibility determination.';

alter table public.organization_registrations enable row level security;

drop policy if exists organization_registrations_select on public.organization_registrations;
create policy organization_registrations_select on public.organization_registrations
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists organization_registrations_insert on public.organization_registrations;
create policy organization_registrations_insert on public.organization_registrations
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists organization_registrations_update on public.organization_registrations;
create policy organization_registrations_update on public.organization_registrations
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists organization_registrations_delete on public.organization_registrations;
create policy organization_registrations_delete on public.organization_registrations
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.organization_registrations to authenticated;

-- ---------------------------------------------------------------------------
-- ALTER compliance_items — inventory enrichment
-- ---------------------------------------------------------------------------
alter table public.compliance_items
  add column if not exists verification_status public.compliance_verification_status not null default 'AI_EXTRACTED',
  add column if not exists verified_by uuid references auth.users (id),
  add column if not exists verified_at timestamptz,
  add column if not exists effective_on date,
  add column if not exists issuer text,
  add column if not exists credential_number text,
  add column if not exists holder_name text,
  add column if not exists coverage_json jsonb,
  add column if not exists source_document_id uuid,
  add column if not exists source_document_version_id uuid,
  add column if not exists source_url text,
  add column if not exists supersedes_id uuid,
  add column if not exists organization_registration_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- HUMAN_VERIFIED requires actor (app + DB). Documented: AI/extraction cannot set HUMAN_VERIFIED.
alter table public.compliance_items
  drop constraint if exists compliance_items_human_verified_requires_actor;
alter table public.compliance_items
  add constraint compliance_items_human_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  );

alter table public.compliance_items
  drop constraint if exists compliance_items_document_same_org_fkey;
alter table public.compliance_items
  add constraint compliance_items_document_same_org_fkey
  foreign key (source_document_id, organization_id)
  references public.documents (id, organization_id)
  on delete set null;

alter table public.compliance_items
  drop constraint if exists compliance_items_supersedes_same_org_fkey;
alter table public.compliance_items
  add constraint compliance_items_supersedes_same_org_fkey
  foreign key (supersedes_id, organization_id)
  references public.compliance_items (id, organization_id)
  on delete set null;

alter table public.compliance_items
  drop constraint if exists compliance_items_registration_same_org_fkey;
alter table public.compliance_items
  add constraint compliance_items_registration_same_org_fkey
  foreign key (organization_registration_id, organization_id)
  references public.organization_registrations (id, organization_id)
  on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compliance_items_source_document_version_fkey'
  ) then
    alter table public.compliance_items
      add constraint compliance_items_source_document_version_fkey
      foreign key (source_document_version_id)
      references public.document_versions (id)
      on delete set null;
  end if;
end $$;

create index if not exists compliance_items_verification_idx
  on public.compliance_items (organization_id, verification_status);
create index if not exists compliance_items_kind_idx
  on public.compliance_items (organization_id, kind);
create index if not exists compliance_items_registration_idx
  on public.compliance_items (organization_id, organization_registration_id)
  where organization_registration_id is not null;

comment on column public.compliance_items.verification_status is
  'AI_EXTRACTED until human verify.promote. HUMAN_VERIFIED requires verified_by + verified_at.';
comment on column public.compliance_items.coverage_json is
  'Opaque recorded COI/insurance limits from source evidence — never invent limits.';
comment on column public.compliance_items.holder_name is
  'Personnel qualification holder when kind = personnel_qualification.';
comment on column public.compliance_items.organization_registration_id is
  'When kind=registration, links mirrored SAM/entity row for F9 compliance_expiration.';

-- ---------------------------------------------------------------------------
-- requirement_compliance_matches
-- ---------------------------------------------------------------------------
create table if not exists public.requirement_compliance_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requirement_id uuid not null,
  opportunity_id uuid,
  compliance_item_id uuid,
  organization_registration_id uuid,
  match_status public.requirement_compliance_match_status not null default 'UNKNOWN',
  rationale text,
  evidence_links jsonb not null default '[]'::jsonb,
  required_coverage_json jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint requirement_compliance_matches_requirement_same_org_fkey
    foreign key (requirement_id, organization_id)
    references public.requirements (id, organization_id)
    on delete cascade,
  constraint requirement_compliance_matches_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint requirement_compliance_matches_item_same_org_fkey
    foreign key (compliance_item_id, organization_id)
    references public.compliance_items (id, organization_id)
    on delete set null,
  constraint requirement_compliance_matches_registration_same_org_fkey
    foreign key (organization_registration_id, organization_id)
    references public.organization_registrations (id, organization_id)
    on delete set null,
  constraint requirement_compliance_matches_has_target check (
    compliance_item_id is not null
    or organization_registration_id is not null
    or match_status in ('MISSING', 'UNKNOWN', 'NOT_APPLICABLE')
  )
);

create index if not exists requirement_compliance_matches_req_idx
  on public.requirement_compliance_matches (organization_id, requirement_id);
create index if not exists requirement_compliance_matches_opp_idx
  on public.requirement_compliance_matches (organization_id, opportunity_id)
  where opportunity_id is not null;
create index if not exists requirement_compliance_matches_status_idx
  on public.requirement_compliance_matches (organization_id, match_status);

comment on table public.requirement_compliance_matches is
  'Deterministic requirement↔inventory match. VERIFIED_AVAILABLE only when inventory is HUMAN_VERIFIED with source.';
comment on column public.requirement_compliance_matches.match_status is
  'Advisory status — not a legal eligibility ruling. GPT must not declare eligibility.';

alter table public.requirement_compliance_matches enable row level security;

drop policy if exists requirement_compliance_matches_select on public.requirement_compliance_matches;
create policy requirement_compliance_matches_select on public.requirement_compliance_matches
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists requirement_compliance_matches_insert on public.requirement_compliance_matches;
create policy requirement_compliance_matches_insert on public.requirement_compliance_matches
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists requirement_compliance_matches_update on public.requirement_compliance_matches;
create policy requirement_compliance_matches_update on public.requirement_compliance_matches
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists requirement_compliance_matches_delete on public.requirement_compliance_matches;
create policy requirement_compliance_matches_delete on public.requirement_compliance_matches
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.requirement_compliance_matches to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: refuse HUMAN_VERIFIED without actor (defense in depth beyond CHECK)
-- ---------------------------------------------------------------------------
create or replace function public.compliance_refuse_ai_human_verified()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status = 'HUMAN_VERIFIED' then
    if new.verified_by is null or new.verified_at is null then
      raise exception
        'HUMAN_VERIFIED on % requires verified_by + verified_at (human verify.promote path only; AI cannot set)',
        tg_table_name;
    end if;
  end if;
  -- Clearing actor while staying HUMAN_VERIFIED is also refused by CHECK;
  -- additionally block AI paths that try to "upgrade" without actor change.
  if tg_op = 'UPDATE'
     and new.verification_status = 'HUMAN_VERIFIED'
     and old.verification_status is distinct from 'HUMAN_VERIFIED'
     and new.verified_by is null then
    raise exception 'Cannot promote to HUMAN_VERIFIED without verified_by';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_items_refuse_ai_human_verified on public.compliance_items;
create trigger compliance_items_refuse_ai_human_verified
  before insert or update on public.compliance_items
  for each row execute function public.compliance_refuse_ai_human_verified();

drop trigger if exists organization_registrations_refuse_ai_human_verified on public.organization_registrations;
create trigger organization_registrations_refuse_ai_human_verified
  before insert or update on public.organization_registrations
  for each row execute function public.compliance_refuse_ai_human_verified();

-- ---------------------------------------------------------------------------
-- Trigger: VERIFIED_AVAILABLE requires HUMAN_VERIFIED inventory + source
-- ---------------------------------------------------------------------------
create or replace function public.requirement_match_verified_available_gate()
returns trigger
language plpgsql
as $$
declare
  v_status public.compliance_verification_status;
  v_has_source boolean := false;
begin
  if new.match_status is distinct from 'VERIFIED_AVAILABLE' then
    return new;
  end if;

  if new.compliance_item_id is not null then
    select c.verification_status,
           (c.source_document_id is not null
             or c.source_document_version_id is not null
             or c.source_fact_id is not null
             or (c.source_url is not null and length(btrim(c.source_url)) > 0))
      into v_status, v_has_source
    from public.compliance_items c
    where c.id = new.compliance_item_id
      and c.organization_id = new.organization_id;

    if v_status is distinct from 'HUMAN_VERIFIED' then
      raise exception
        'VERIFIED_AVAILABLE requires compliance_items.verification_status = HUMAN_VERIFIED (got %)',
        coalesce(v_status::text, 'missing');
    end if;
    if not coalesce(v_has_source, false) then
      raise exception
        'VERIFIED_AVAILABLE requires source evidence on compliance_items (missing source ≠ VERIFIED_AVAILABLE)';
    end if;
    return new;
  end if;

  if new.organization_registration_id is not null then
    select r.verification_status,
           (r.source_document_id is not null
             or r.source_document_version_id is not null
             or r.source_fact_id is not null
             or (r.source_url is not null and length(btrim(r.source_url)) > 0))
      into v_status, v_has_source
    from public.organization_registrations r
    where r.id = new.organization_registration_id
      and r.organization_id = new.organization_id;

    if v_status is distinct from 'HUMAN_VERIFIED' then
      raise exception
        'VERIFIED_AVAILABLE requires organization_registrations.verification_status = HUMAN_VERIFIED (got %)',
        coalesce(v_status::text, 'missing');
    end if;
    if not coalesce(v_has_source, false) then
      raise exception
        'VERIFIED_AVAILABLE requires source evidence on organization_registrations';
    end if;
    return new;
  end if;

  raise exception
    'VERIFIED_AVAILABLE requires a linked HUMAN_VERIFIED compliance_item or organization_registration with source';
end;
$$;

drop trigger if exists requirement_match_verified_available_gate on public.requirement_compliance_matches;
create trigger requirement_match_verified_available_gate
  before insert or update on public.requirement_compliance_matches
  for each row execute function public.requirement_match_verified_available_gate();

-- ---------------------------------------------------------------------------
-- Mirror SAM expiry into compliance_items (kind=registration) so F9 refresh works
-- ---------------------------------------------------------------------------
create or replace function public.mirror_sam_registration_to_compliance_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  stmt text;
begin
  if new.sam_expiration_on is null then
    return new;
  end if;

  stmt := format(
    'SAM registration%s%s — expires %s (mirrored for F9 compliance_expiration; not a legal eligibility ruling)',
    case when new.uei is not null then ' UEI ' || new.uei else '' end,
    case when new.cage is not null then ' CAGE ' || new.cage else '' end,
    new.sam_expiration_on::text
  );

  select c.id into existing_id
  from public.compliance_items c
  where c.organization_id = new.organization_id
    and c.organization_registration_id = new.id
    and c.kind = 'registration'
  order by c.created_at desc
  limit 1;

  if existing_id is not null then
    update public.compliance_items
      set statement = stmt,
          expires_on = new.sam_expiration_on,
          verification_status = new.verification_status,
          verified_by = new.verified_by,
          verified_at = new.verified_at,
          source_document_id = new.source_document_id,
          source_document_version_id = new.source_document_version_id,
          source_url = new.source_url,
          source_fact_id = new.source_fact_id,
          updated_at = now()
      where id = existing_id;
  else
    insert into public.compliance_items (
      organization_id,
      kind,
      statement,
      expires_on,
      verification_status,
      verified_by,
      verified_at,
      source_document_id,
      source_document_version_id,
      source_url,
      source_fact_id,
      organization_registration_id
    ) values (
      new.organization_id,
      'registration',
      stmt,
      new.sam_expiration_on,
      new.verification_status,
      new.verified_by,
      new.verified_at,
      new.source_document_id,
      new.source_document_version_id,
      new.source_url,
      new.source_fact_id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists organization_registrations_mirror_sam on public.organization_registrations;
create trigger organization_registrations_mirror_sam
  after insert or update of sam_expiration_on, uei, cage, verification_status, verified_by, verified_at,
    source_document_id, source_document_version_id, source_url, source_fact_id
  on public.organization_registrations
  for each row execute function public.mirror_sam_registration_to_compliance_item();

comment on function public.mirror_sam_registration_to_compliance_item() is
  'Mirrors organization_registrations.sam_expiration_on into compliance_items kind=registration so private.refresh_compliance_expiration_alerts (F9) continues without a second cron.';

-- ---------------------------------------------------------------------------
-- Promote path: mark compliance from HUMAN_VERIFIED fact with actor attribution
-- (extends promote_contract_from_fact compliance branch — sets verification_status)
-- ---------------------------------------------------------------------------
-- Note: full promote_contract_from_fact body lives in earlier migrations; we only
-- document that new inserts should default AI_EXTRACTED and humans promote via app.
-- Existing inserts from promote stay AI_EXTRACTED until verify.promote marks them.

comment on function private.refresh_compliance_expiration_alerts() is
  'F9: scans compliance_items.expires_on including mirrored SAM registration rows. No second scheduler for F12.';
