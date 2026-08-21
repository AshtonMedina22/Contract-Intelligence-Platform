-- F7: Historical Proposal Content Intelligence + Reuse Engine
-- Extends proposal_sections + document_chunks + search_verified_knowledge.
-- Won ≠ APPROVED. Lost ≠ DO_NOT_USE. Promote defaults to REVIEW_REQUIRED.

-- ---------------------------------------------------------------------------
-- proposal_content_runs (F4/F6 shaped audit)
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.proposal_content_run_status as enum (
    'QUEUED',
    'EXTRACTING',
    'REVIEW_READY',
    'FAILED',
    'DONE'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.proposal_content_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  opportunity_id uuid,
  status public.proposal_content_run_status not null default 'QUEUED',
  plan jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  unique (id, organization_id),
  constraint proposal_content_runs_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete cascade,
  constraint proposal_content_runs_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null
);

create index if not exists proposal_content_runs_organization_id_idx
  on public.proposal_content_runs (organization_id);
create index if not exists proposal_content_runs_document_id_idx
  on public.proposal_content_runs (organization_id, document_id);
create index if not exists proposal_content_runs_status_idx
  on public.proposal_content_runs (organization_id, status);

comment on table public.proposal_content_runs is
  'F7 proposal section extraction runs. Sections stay AI_EXTRACTED until human verification; never auto APPROVED from WON.';
comment on column public.proposal_content_runs.plan is
  'Extraction plan JSON (taxonomy keys, page markers, options).';
comment on column public.proposal_content_runs.result_summary is
  'Counts / section keys extracted — never full proposal dump.';

alter table public.proposal_content_runs enable row level security;

drop policy if exists proposal_content_runs_select on public.proposal_content_runs;
create policy proposal_content_runs_select on public.proposal_content_runs
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists proposal_content_runs_insert on public.proposal_content_runs;
create policy proposal_content_runs_insert on public.proposal_content_runs
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists proposal_content_runs_update on public.proposal_content_runs;
create policy proposal_content_runs_update on public.proposal_content_runs
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update on public.proposal_content_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Extend proposal_sections
-- ---------------------------------------------------------------------------
alter table public.proposal_sections
  add column if not exists body_text text,
  add column if not exists verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  add column if not exists reuse_status public.reuse_status,
  add column if not exists superseded_by_id uuid,
  add column if not exists content_run_id uuid,
  add column if not exists outcome_snapshot text,
  add column if not exists buyer_name text,
  add column if not exists page_start integer,
  add column if not exists page_end integer;

-- Allow history: multiple SUPERSEDED rows may share section_key with the active one.
-- Postgres truncates identifiers to 63 bytes; the live unique was
-- proposal_sections_organization_id_opportunity_id_section_ke_key.
alter table public.proposal_sections
  drop constraint if exists proposal_sections_organization_id_opportunity_id_section_ke_key;
alter table public.proposal_sections
  drop constraint if exists proposal_sections_organization_id_opportunity_id_section_key_key;

create unique index if not exists proposal_sections_org_opp_key_active_uidx
  on public.proposal_sections (organization_id, opportunity_id, section_key)
  where reuse_status is distinct from 'SUPERSEDED';

alter table public.proposal_sections
  drop constraint if exists proposal_sections_superseded_by_same_org_fkey;
alter table public.proposal_sections
  add constraint proposal_sections_superseded_by_same_org_fkey
  foreign key (superseded_by_id, organization_id)
  references public.proposal_sections (id, organization_id)
  on delete set null;

alter table public.proposal_sections
  drop constraint if exists proposal_sections_content_run_same_org_fkey;
alter table public.proposal_sections
  add constraint proposal_sections_content_run_same_org_fkey
  foreign key (content_run_id, organization_id)
  references public.proposal_content_runs (id, organization_id)
  on delete set null;

create index if not exists proposal_sections_reuse_idx
  on public.proposal_sections (organization_id, reuse_status)
  where reuse_status is not null;
create index if not exists proposal_sections_verification_idx
  on public.proposal_sections (organization_id, verification_status);
create index if not exists proposal_sections_section_key_idx
  on public.proposal_sections (organization_id, section_key);
create index if not exists proposal_sections_content_run_idx
  on public.proposal_sections (content_run_id)
  where content_run_id is not null;

comment on column public.proposal_sections.body_text is
  'Full section body for reuse / drafting. Prefer over excerpt when present.';
comment on column public.proposal_sections.verification_status is
  'AI_EXTRACTED until a human verifies. Never auto HUMAN_VERIFIED.';
comment on column public.proposal_sections.reuse_status is
  'Null until human/policy sets APPROVED|REVIEW_REQUIRED|DO_NOT_USE|SUPERSEDED. Outcome never auto-sets this.';
comment on column public.proposal_sections.outcome_snapshot is
  'Display-only WON/LOST/etc context. NEVER drives reuse_status or drafting eligibility.';
comment on column public.proposal_sections.page_start is
  'Provenance page start (inclusive). Falls back to source_page when null.';
comment on column public.proposal_sections.page_end is
  'Provenance page end (inclusive).';

-- ---------------------------------------------------------------------------
-- Fix promote_knowledge_chunk_from_fact: default REVIEW_REQUIRED; refuse unless HUMAN_VERIFIED
-- ---------------------------------------------------------------------------
alter table public.document_chunks
  alter column reuse_status set default 'REVIEW_REQUIRED';

create or replace function public.promote_knowledge_chunk_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  ver public.document_versions%rowtype;
  body text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into fact from public.extracted_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if fact.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Only HUMAN_VERIFIED facts become chunks.');
  end if;

  select * into ver from public.document_versions where id = fact.document_version_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;

  body := nullif(btrim(concat_ws(
    E'\n',
    nullif(btrim(coalesce(fact.field, '')), ''),
    nullif(btrim(coalesce(fact.verified_value, fact.normalized_value, fact.raw_value, '')), ''),
    nullif(btrim(coalesce(fact.source_excerpt, '')), '')
  )), '');
  if body is null then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Empty verified content.');
  end if;

  insert into public.document_chunks (
    organization_id,
    document_id,
    document_version_id,
    source_fact_id,
    chunk_index,
    field,
    content,
    source_page,
    source_section,
    storage_bucket,
    storage_path,
    verification_status,
    reuse_status,
    is_current_version
  )
  values (
    fact.organization_id,
    fact.document_id,
    fact.document_version_id,
    fact.id,
    0,
    fact.field,
    body,
    fact.source_page,
    fact.source_section,
    ver.storage_bucket,
    ver.storage_path,
    'HUMAN_VERIFIED',
    'REVIEW_REQUIRED',
    ver.is_current
  )
  on conflict (source_fact_id) where source_fact_id is not null
  do update set
    content = excluded.content,
    field = excluded.field,
    source_page = excluded.source_page,
    source_section = excluded.source_section,
    storage_path = excluded.storage_path,
    is_current_version = excluded.is_current_version,
    verification_status = 'HUMAN_VERIFIED',
    -- Never auto-APPROVED; preserve human reuse decisions on re-promote.
    reuse_status = case
      when document_chunks.reuse_status in ('APPROVED', 'DO_NOT_USE', 'SUPERSEDED', 'REVIEW_REQUIRED')
        then document_chunks.reuse_status
      else 'REVIEW_REQUIRED'
    end,
    updated_at = now();

  return jsonb_build_object('ok', true, 'action', 'chunked', 'reuse_status', 'REVIEW_REQUIRED');
end;
$$;

comment on function public.promote_knowledge_chunk_from_fact(uuid) is
  'Promote HUMAN_VERIFIED fact → document_chunks with reuse_status REVIEW_REQUIRED by default. Never sets APPROVED from WON.';

-- Keep proposal section promoter aligned: HUMAN_VERIFIED gate; reuse starts REVIEW_REQUIRED.
create or replace function public.promote_proposal_section_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  field_l text;
  value_text text;
  section_key_v text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into fact from public.extracted_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if fact.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Only HUMAN_VERIFIED facts promote.');
  end if;

  select * into doc from public.documents where id = fact.document_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if doc.opportunity_id is null then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'No opportunity.');
  end if;

  field_l := lower(coalesce(fact.field, ''));
  if field_l <> 'proposal_section' and lower(coalesce(fact.entity, '')) <> 'proposal' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a proposal section.');
  end if;

  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  section_key_v := left(regexp_replace(lower(value_text), '[^a-z0-9]+', '_', 'g'), 80);

  insert into public.proposal_sections (
    organization_id, opportunity_id, source_document_id, source_fact_id,
    section_key, title, source_page, excerpt, body_text,
    verification_status, reuse_status, page_start, page_end
  )
  values (
    fact.organization_id,
    doc.opportunity_id,
    doc.id,
    fact.id,
    section_key_v,
    left(value_text, 200),
    fact.source_page,
    left(coalesce(fact.source_excerpt, value_text), 2000),
    left(coalesce(fact.source_excerpt, value_text), 20000),
    'HUMAN_VERIFIED',
    'REVIEW_REQUIRED',
    fact.source_page,
    fact.source_page
  )
  on conflict (organization_id, opportunity_id, section_key)
    where reuse_status is distinct from 'SUPERSEDED'
  do update set
    title = excluded.title,
    source_page = excluded.source_page,
    excerpt = excluded.excerpt,
    body_text = excluded.body_text,
    source_fact_id = excluded.source_fact_id,
    source_document_id = excluded.source_document_id,
    verification_status = 'HUMAN_VERIFIED',
    reuse_status = coalesce(public.proposal_sections.reuse_status, 'REVIEW_REQUIRED'),
    page_start = coalesce(excluded.page_start, public.proposal_sections.page_start),
    page_end = coalesce(excluded.page_end, public.proposal_sections.page_end);

  return jsonb_build_object('ok', true, 'action', 'proposal_section', 'reuse_status', 'REVIEW_REQUIRED');
end;
$$;

comment on function public.promote_proposal_section_from_fact(uuid) is
  'Maps HUMAN_VERIFIED proposal_section facts to proposal_sections with reuse_status REVIEW_REQUIRED (never auto APPROVED).';

-- ---------------------------------------------------------------------------
-- supersede_proposal_section — preserve history; no deletes
-- ---------------------------------------------------------------------------
create or replace function public.supersede_proposal_section(p_old_id uuid, p_new_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_row public.proposal_sections%rowtype;
  new_row public.proposal_sections%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if p_old_id is null or p_new_id is null or p_old_id = p_new_id then
    return jsonb_build_object('ok', false, 'action', 'invalid', 'message', 'Distinct old and new ids required.');
  end if;

  select * into old_row from public.proposal_sections where id = p_old_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing', 'message', 'Old section not found.');
  end if;
  if not public.is_org_member(old_row.organization_id) then
    raise exception 'Not authorized';
  end if;

  select * into new_row from public.proposal_sections where id = p_new_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing', 'message', 'New section not found.');
  end if;
  if new_row.organization_id <> old_row.organization_id then
    return jsonb_build_object('ok', false, 'action', 'tenant', 'message', 'Sections must share organization_id.');
  end if;

  update public.proposal_sections
  set
    reuse_status = 'SUPERSEDED',
    superseded_by_id = p_new_id
  where id = p_old_id;

  -- Prefer current: mark related chunk non-current when linked via source_fact_id.
  if old_row.source_fact_id is not null then
    update public.document_chunks
    set
      is_current_version = false,
      reuse_status = 'SUPERSEDED',
      updated_at = now()
    where source_fact_id = old_row.source_fact_id
      and organization_id = old_row.organization_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'superseded',
    'old_id', p_old_id,
    'new_id', p_new_id
  );
end;
$$;

revoke all on function public.supersede_proposal_section(uuid, uuid) from public;
grant execute on function public.supersede_proposal_section(uuid, uuid) to authenticated;

comment on function public.supersede_proposal_section(uuid, uuid) is
  'Mark old proposal_section SUPERSEDED pointing at new; mark related chunk non-current. Never deletes.';

-- ---------------------------------------------------------------------------
-- set_proposal_section_reuse — human-gated; outcome never auto-sets
-- ---------------------------------------------------------------------------
create or replace function public.set_proposal_section_reuse(
  p_section_id uuid,
  p_reuse_status public.reuse_status,
  p_actor_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  sec public.proposal_sections%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if p_reuse_status is null then
    return jsonb_build_object('ok', false, 'action', 'invalid', 'message', 'reuse_status required.');
  end if;
  if p_reuse_status = 'SUPERSEDED' then
    return jsonb_build_object(
      'ok', false,
      'action', 'use_supersede',
      'message', 'Use supersede_proposal_section to mark SUPERSEDED.'
    );
  end if;

  select * into sec from public.proposal_sections where id = p_section_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if not public.is_org_member(sec.organization_id) then
    raise exception 'Not authorized';
  end if;

  -- APPROVED requires HUMAN_VERIFIED section text — never from WON alone.
  if p_reuse_status = 'APPROVED' and sec.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object(
      'ok', false,
      'action', 'refused',
      'message', 'APPROVED requires HUMAN_VERIFIED verification_status. Won ≠ auto-approve.'
    );
  end if;

  update public.proposal_sections
  set reuse_status = p_reuse_status
  where id = p_section_id;

  -- Keep linked chunk aligned when present (human decision only).
  if sec.source_fact_id is not null then
    update public.document_chunks
    set
      reuse_status = p_reuse_status,
      updated_at = now()
    where source_fact_id = sec.source_fact_id
      and organization_id = sec.organization_id
      and verification_status = 'HUMAN_VERIFIED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'reuse_set',
    'reuse_status', p_reuse_status,
    'note', left(coalesce(p_actor_note, ''), 500)
  );
end;
$$;

revoke all on function public.set_proposal_section_reuse(uuid, public.reuse_status, text) from public;
grant execute on function public.set_proposal_section_reuse(uuid, public.reuse_status, text) to authenticated;

comment on function public.set_proposal_section_reuse(uuid, public.reuse_status, text) is
  'Human-gated reuse_status setter. APPROVED requires HUMAN_VERIFIED. Outcome never drives this RPC.';
