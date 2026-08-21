-- F11: Addenda + Q&A + Solicitation Change-Impact Engine
-- Detected changes stay AI_EXTRACTED until human verify.promote.
-- Apply refuses unless HUMAN_VERIFIED; never sets HUMAN_APPROVED / draft APPROVED.
-- SemanticDiff rejected; OpenContracts = provenance pattern only.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.solicitation_change_trigger_kind as enum (
    'ADDENDUM',
    'Q_AND_A',
    'CLARIFICATION',
    'BASELINE'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.solicitation_change_run_status as enum (
    'AI_EXTRACTED',
    'NEEDS_REVIEW',
    'PARTIALLY_VERIFIED',
    'HUMAN_VERIFIED',
    'REJECTED',
    'APPLIED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.solicitation_change_type as enum (
    'DEADLINE_CHANGE',
    'REQUIREMENT_ADDED',
    'REQUIREMENT_MODIFIED',
    'REQUIREMENT_REMOVED',
    'PRICING_CHANGE',
    'FORM_ADDED',
    'FORM_REMOVED',
    'EVALUATION_CHANGE',
    'SCOPE_CHANGE',
    'STAFFING_CHANGE',
    'COMPLIANCE_CHANGE',
    'SUBMISSION_METHOD_CHANGE',
    'Q_A_CLARIFICATION',
    'OTHER'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- ALTER solicitation_addenda — supersession + verification chain
-- ---------------------------------------------------------------------------
alter table public.solicitation_addenda
  add column if not exists supersedes_addendum_id uuid,
  add column if not exists source_document_version_id uuid,
  add column if not exists verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  add column if not exists is_latest boolean not null default false,
  add column if not exists effective_on date;

alter table public.solicitation_addenda
  drop constraint if exists solicitation_addenda_supersedes_same_org_fkey;
alter table public.solicitation_addenda
  add constraint solicitation_addenda_supersedes_same_org_fkey
  foreign key (supersedes_addendum_id, organization_id)
  references public.solicitation_addenda (id, organization_id)
  on delete set null;

alter table public.solicitation_addenda
  drop constraint if exists solicitation_addenda_document_version_same_org_fkey;
-- document_versions may not have (id, organization_id) composite; link by id only
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'solicitation_addenda_source_document_version_fkey'
  ) then
    alter table public.solicitation_addenda
      add constraint solicitation_addenda_source_document_version_fkey
      foreign key (source_document_version_id)
      references public.document_versions (id)
      on delete set null;
  end if;
end $$;

create unique index if not exists solicitation_addenda_one_latest_per_sol_uidx
  on public.solicitation_addenda (organization_id, solicitation_id)
  where is_latest = true;

create index if not exists solicitation_addenda_verification_idx
  on public.solicitation_addenda (organization_id, verification_status);

comment on column public.solicitation_addenda.supersedes_addendum_id is
  'Prior addendum this row supersedes. Old row preserved; never deleted by promote.';
comment on column public.solicitation_addenda.verification_status is
  'AI_EXTRACTED until human verify.promote. Never auto HUMAN_VERIFIED.';
comment on column public.solicitation_addenda.is_latest is
  'Partial unique: at most one latest addendum per solicitation.';
comment on column public.solicitation_addenda.effective_on is
  'Optional effective date when distinct from issued_on.';

-- ---------------------------------------------------------------------------
-- solicitation_q_and_a
-- ---------------------------------------------------------------------------
create table if not exists public.solicitation_q_and_a (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitation_id uuid not null,
  source_document_id uuid,
  source_document_version_id uuid,
  source_fact_id uuid,
  question_text text not null,
  answer_text text,
  issued_on date,
  section_ref text,
  verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  supersedes_qa_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint solicitation_q_and_a_solicitation_same_org_fkey
    foreign key (solicitation_id, organization_id)
    references public.solicitations (id, organization_id)
    on delete cascade,
  constraint solicitation_q_and_a_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint solicitation_q_and_a_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint solicitation_q_and_a_supersedes_same_org_fkey
    foreign key (supersedes_qa_id, organization_id)
    references public.solicitation_q_and_a (id, organization_id)
    on delete set null,
  constraint solicitation_q_and_a_source_document_version_fkey
    foreign key (source_document_version_id)
    references public.document_versions (id)
    on delete set null
);

create index if not exists solicitation_q_and_a_solicitation_idx
  on public.solicitation_q_and_a (organization_id, solicitation_id);
create index if not exists solicitation_q_and_a_verification_idx
  on public.solicitation_q_and_a (organization_id, verification_status);

comment on table public.solicitation_q_and_a is
  'Buyer Q&A / clarifications. Precedence over base RFP when HUMAN_VERIFIED. Conflicts stay unmatched.';

alter table public.solicitation_q_and_a enable row level security;

drop policy if exists solicitation_q_and_a_select on public.solicitation_q_and_a;
create policy solicitation_q_and_a_select on public.solicitation_q_and_a
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists solicitation_q_and_a_insert on public.solicitation_q_and_a;
create policy solicitation_q_and_a_insert on public.solicitation_q_and_a
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists solicitation_q_and_a_update on public.solicitation_q_and_a;
create policy solicitation_q_and_a_update on public.solicitation_q_and_a
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists solicitation_q_and_a_delete on public.solicitation_q_and_a;
create policy solicitation_q_and_a_delete on public.solicitation_q_and_a
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.solicitation_q_and_a to authenticated;

-- ---------------------------------------------------------------------------
-- solicitation_change_runs + solicitation_change_items
-- ---------------------------------------------------------------------------
create table if not exists public.solicitation_change_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitation_id uuid not null,
  opportunity_id uuid,
  trigger_kind public.solicitation_change_trigger_kind not null,
  trigger_addendum_id uuid,
  trigger_qa_id uuid,
  trigger_document_id uuid,
  trigger_document_version_id uuid,
  base_document_id uuid,
  status public.solicitation_change_run_status not null default 'AI_EXTRACTED',
  summary_json jsonb not null default '{}'::jsonb,
  detector_version text not null default 'f11-heuristics-v1',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint solicitation_change_runs_solicitation_same_org_fkey
    foreign key (solicitation_id, organization_id)
    references public.solicitations (id, organization_id)
    on delete cascade,
  constraint solicitation_change_runs_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint solicitation_change_runs_addendum_same_org_fkey
    foreign key (trigger_addendum_id, organization_id)
    references public.solicitation_addenda (id, organization_id)
    on delete set null,
  constraint solicitation_change_runs_qa_same_org_fkey
    foreign key (trigger_qa_id, organization_id)
    references public.solicitation_q_and_a (id, organization_id)
    on delete set null
);

create index if not exists solicitation_change_runs_org_idx
  on public.solicitation_change_runs (organization_id);
create index if not exists solicitation_change_runs_sol_idx
  on public.solicitation_change_runs (organization_id, solicitation_id);
create index if not exists solicitation_change_runs_status_idx
  on public.solicitation_change_runs (organization_id, status);

comment on table public.solicitation_change_runs is
  'AI draft impact runs after addendum/Q&A promote. Material apply only after human verify.';
comment on column public.solicitation_change_runs.summary_json is
  'Honest counts: matched/changed/added/removed/ambiguous/unreviewed — never invented precision.';

alter table public.solicitation_change_runs enable row level security;

drop policy if exists solicitation_change_runs_select on public.solicitation_change_runs;
create policy solicitation_change_runs_select on public.solicitation_change_runs
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists solicitation_change_runs_insert on public.solicitation_change_runs;
create policy solicitation_change_runs_insert on public.solicitation_change_runs
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists solicitation_change_runs_update on public.solicitation_change_runs;
create policy solicitation_change_runs_update on public.solicitation_change_runs
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update on public.solicitation_change_runs to authenticated;

create table if not exists public.solicitation_change_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  change_run_id uuid not null,
  change_type public.solicitation_change_type not null,
  fingerprint text not null,
  target_table text,
  target_id uuid,
  before_text text,
  after_text text,
  before_json jsonb,
  after_json jsonb,
  confidence text not null default 'heuristic',
  ambiguity_reason text,
  verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  impact_flags jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  applied_by uuid references auth.users (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (change_run_id, fingerprint),
  constraint solicitation_change_items_run_same_org_fkey
    foreign key (change_run_id, organization_id)
    references public.solicitation_change_runs (id, organization_id)
    on delete cascade
);

create index if not exists solicitation_change_items_run_idx
  on public.solicitation_change_items (organization_id, change_run_id);
create index if not exists solicitation_change_items_verification_idx
  on public.solicitation_change_items (organization_id, verification_status);
create index if not exists solicitation_change_items_type_idx
  on public.solicitation_change_items (organization_id, change_type);

comment on table public.solicitation_change_items is
  'Detected solicitation deltas. Apply only when HUMAN_VERIFIED. Ambiguous/conflict never auto-applied.';
comment on column public.solicitation_change_items.impact_flags is
  'e.g. {responses:true,pricing:true,deadlines:true,checklist:true} — flags only; never wipe APPROVED text.';

alter table public.solicitation_change_items enable row level security;

drop policy if exists solicitation_change_items_select on public.solicitation_change_items;
create policy solicitation_change_items_select on public.solicitation_change_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists solicitation_change_items_insert on public.solicitation_change_items;
create policy solicitation_change_items_insert on public.solicitation_change_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists solicitation_change_items_update on public.solicitation_change_items;
create policy solicitation_change_items_update on public.solicitation_change_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update on public.solicitation_change_items to authenticated;

-- ---------------------------------------------------------------------------
-- Impact flags on responses / pricing — stale_reason only (preserve text)
-- ---------------------------------------------------------------------------
alter table public.requirement_responses
  add column if not exists stale_reason text;

alter table public.pricing_decisions
  add column if not exists stale_reason text;

comment on column public.requirement_responses.stale_reason is
  'Set when a verified solicitation change may invalidate APPROVED draft text. Never clears draft_html or draft_status=APPROVED by itself.';
comment on column public.pricing_decisions.stale_reason is
  'Set when a verified pricing/solicitation change may invalidate HUMAN_APPROVED price. Never clears status or rates by itself.';

-- requirements.superseded_by_id (history preserve)
alter table public.requirements
  add column if not exists superseded_by_id uuid,
  add column if not exists impact_from_change_item_id uuid;

alter table public.requirements
  drop constraint if exists requirements_superseded_by_same_org_fkey;
alter table public.requirements
  add constraint requirements_superseded_by_same_org_fkey
  foreign key (superseded_by_id, organization_id)
  references public.requirements (id, organization_id)
  on delete set null;

alter table public.requirements
  drop constraint if exists requirements_impact_change_item_fkey;
alter table public.requirements
  add constraint requirements_impact_change_item_fkey
  foreign key (impact_from_change_item_id)
  references public.solicitation_change_items (id)
  on delete set null;

comment on column public.requirements.superseded_by_id is
  'New requirement that supersedes this row. Old statement preserved for audit.';

-- ---------------------------------------------------------------------------
-- Promote addendum / Q&A from HUMAN_VERIFIED facts
-- ---------------------------------------------------------------------------
create or replace function public.promote_addendum_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  field_l text;
  entity_l text;
  value_text text;
  sol_id uuid;
  prior_id uuid;
  new_id uuid;
  ver_id uuid;
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
  entity_l := lower(coalesce(fact.entity, ''));
  if field_l not in ('addendum', 'addendum_number', 'addendum_title')
     and entity_l not in ('addendum', 'addenda')
     and lower(coalesce(doc.document_type, '')) not in ('addendum', 'addenda') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not an addendum fact.');
  end if;

  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  if value_text is null or btrim(value_text) = '' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Empty addendum value.');
  end if;

  sol_id := public.ensure_solicitation(
    fact.organization_id,
    doc.opportunity_id,
    doc.client_id,
    doc.id,
    coalesce(doc.original_filename, 'Solicitation')
  );
  update public.documents
    set solicitation_id = sol_id, updated_at = now()
    where id = doc.id and solicitation_id is null;

  select id into prior_id
  from public.solicitation_addenda
  where organization_id = fact.organization_id
    and solicitation_id = sol_id
    and is_latest = true
  limit 1;

  select id into ver_id
  from public.document_versions
  where document_id = doc.id and is_current = true
  limit 1;

  -- Clear prior latest before insert (partial unique)
  update public.solicitation_addenda
    set is_latest = false
    where organization_id = fact.organization_id
      and solicitation_id = sol_id
      and is_latest = true;

  insert into public.solicitation_addenda (
    organization_id, solicitation_id, source_document_id, source_document_version_id,
    source_fact_id, addendum_number, title, notes, verification_status, is_latest,
    supersedes_addendum_id
  )
  values (
    fact.organization_id,
    sol_id,
    doc.id,
    ver_id,
    fact.id,
    case when field_l = 'addendum_number' then left(btrim(value_text), 64) else null end,
    case when field_l <> 'addendum_number' then left(btrim(value_text), 500) else left(btrim(value_text), 500) end,
    'Promoted from HUMAN_VERIFIED fact',
    'HUMAN_VERIFIED',
    true,
    prior_id
  )
  returning id into new_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'addendum',
    'addendum_id', new_id,
    'solicitation_id', sol_id,
    'supersedes_addendum_id', prior_id
  );
end;
$$;

revoke all on function public.promote_addendum_from_fact(uuid) from public;
grant execute on function public.promote_addendum_from_fact(uuid) to authenticated;

create or replace function public.promote_qa_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  field_l text;
  entity_l text;
  value_text text;
  sol_id uuid;
  new_id uuid;
  ver_id uuid;
  q_text text;
  a_text text;
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
  entity_l := lower(coalesce(fact.entity, ''));
  if field_l not in ('q_and_a', 'qa', 'clarification', 'question', 'answer')
     and entity_l not in ('q_and_a', 'qa', 'clarification')
     and lower(coalesce(doc.document_type, '')) not in ('q&a', 'q_and_a', 'clarification') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a Q&A fact.');
  end if;

  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  if value_text is null or btrim(value_text) = '' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Empty Q&A value.');
  end if;

  -- Heuristic split: "Q: ... A: ..." or whole blob as question
  if value_text ~* 'q\s*:\s*.+a\s*:\s*.+' then
    q_text := trim(regexp_replace(value_text, '(?is)^.*?q\s*:\s*(.+?)\s*a\s*:.*$', '\1'));
    a_text := trim(regexp_replace(value_text, '(?is)^.*?a\s*:\s*(.+)$', '\1'));
  elsif field_l = 'answer' then
    q_text := coalesce(nullif(btrim(coalesce(fact.source_section, '')), ''), 'Clarification');
    a_text := btrim(value_text);
  else
    q_text := btrim(value_text);
    a_text := null;
  end if;

  sol_id := public.ensure_solicitation(
    fact.organization_id,
    doc.opportunity_id,
    doc.client_id,
    doc.id,
    coalesce(doc.original_filename, 'Solicitation')
  );
  update public.documents
    set solicitation_id = sol_id, updated_at = now()
    where id = doc.id and solicitation_id is null;

  select id into ver_id
  from public.document_versions
  where document_id = doc.id and is_current = true
  limit 1;

  insert into public.solicitation_q_and_a (
    organization_id, solicitation_id, source_document_id, source_document_version_id,
    source_fact_id, question_text, answer_text, section_ref, verification_status
  )
  values (
    fact.organization_id,
    sol_id,
    doc.id,
    ver_id,
    fact.id,
    left(q_text, 4000),
    case when a_text is null then null else left(a_text, 8000) end,
    nullif(btrim(coalesce(fact.source_section, '')), ''),
    'HUMAN_VERIFIED'
  )
  returning id into new_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'q_and_a',
    'qa_id', new_id,
    'solicitation_id', sol_id
  );
end;
$$;

revoke all on function public.promote_qa_from_fact(uuid) from public;
grant execute on function public.promote_qa_from_fact(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Apply verified change item (refuses unless HUMAN_VERIFIED)
-- Never sets HUMAN_APPROVED / draft APPROVED
-- ---------------------------------------------------------------------------
create or replace function public.apply_solicitation_change_item(
  p_item_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item public.solicitation_change_items%rowtype;
  run public.solicitation_change_runs%rowtype;
  sol public.solicitations%rowtype;
  actor uuid;
  new_req_id uuid;
  stale_msg text;
  after_due text;
  after_form text;
  after_stmt text;
begin
  actor := coalesce(p_actor_id, auth.uid());
  if actor is null then
    raise exception 'Not authenticated';
  end if;

  select * into item from public.solicitation_change_items where id = p_item_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;

  if item.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object(
      'ok', false,
      'action', 'refused',
      'message', 'Apply requires HUMAN_VERIFIED change item. AI_EXTRACTED / NEEDS_REVIEW / CONFLICT never apply.'
    );
  end if;

  if item.applied_at is not null then
    return jsonb_build_object('ok', true, 'action', 'noop', 'message', 'Already applied.');
  end if;

  if item.ambiguity_reason is not null and btrim(item.ambiguity_reason) <> '' then
    return jsonb_build_object(
      'ok', false,
      'action', 'refused',
      'message', 'Ambiguous/conflict items are never auto-applied.'
    );
  end if;

  select * into run from public.solicitation_change_runs where id = item.change_run_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing_run');
  end if;

  select * into sol from public.solicitations where id = run.solicitation_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing_solicitation');
  end if;

  stale_msg := 'Stale after solicitation change ' || item.change_type::text || ' (' || item.id::text || '). Re-review required — text/price not cleared.';

  -- Deadline: write opportunity / packet dates from after_json; never invent
  if item.change_type = 'DEADLINE_CHANGE' then
    after_due := coalesce(item.after_json->>'due_on', item.after_text);
    if after_due is not null and btrim(after_due) <> '' and sol.opportunity_id is not null then
      update public.opportunities
        set response_due_on = after_due::date,
            updated_at = now()
        where id = sol.opportunity_id
          and organization_id = item.organization_id;
      update public.submission_packets
        set due_at = (after_due::date)::timestamptz
        where opportunity_id = sol.opportunity_id
          and organization_id = item.organization_id;
    end if;
  end if;

  -- Requirement add: insert new row linked to evidence
  if item.change_type = 'REQUIREMENT_ADDED' then
    after_stmt := coalesce(item.after_text, item.after_json->>'statement');
    if after_stmt is not null and btrim(after_stmt) <> '' then
      insert into public.requirements (
        organization_id, solicitation_id, statement, section_ref,
        impact_from_change_item_id, matrix_status
      )
      values (
        item.organization_id,
        run.solicitation_id,
        left(btrim(after_stmt), 8000),
        nullif(item.after_json->>'section_ref', ''),
        item.id,
        'OPEN'
      )
      returning id into new_req_id;
    end if;
  end if;

  -- Requirement modify: insert new + supersede old; flag responses stale (keep APPROVED text)
  if item.change_type = 'REQUIREMENT_MODIFIED' and item.target_id is not null then
    after_stmt := coalesce(item.after_text, item.after_json->>'statement');
    if after_stmt is not null and btrim(after_stmt) <> '' then
      insert into public.requirements (
        organization_id, solicitation_id, statement, section_ref,
        impact_from_change_item_id, matrix_status, mandatory, scored, weight_pct
      )
      select
        r.organization_id,
        r.solicitation_id,
        left(btrim(after_stmt), 8000),
        coalesce(nullif(item.after_json->>'section_ref', ''), r.section_ref),
        item.id,
        'OPEN',
        r.mandatory,
        r.scored,
        r.weight_pct
      from public.requirements r
      where r.id = item.target_id
        and r.organization_id = item.organization_id
      returning id into new_req_id;

      if new_req_id is not null then
        update public.requirements
          set superseded_by_id = new_req_id
          where id = item.target_id
            and organization_id = item.organization_id;

        update public.requirement_responses
          set stale_reason = stale_msg,
              updated_at = now()
          where requirement_id = item.target_id
            and organization_id = item.organization_id;
        -- Intentionally do NOT clear draft_html or draft_status=APPROVED
      end if;
    end if;
  end if;

  -- Requirement remove: mark matrix; flag responses stale
  if item.change_type = 'REQUIREMENT_REMOVED' and item.target_id is not null then
    update public.requirement_responses
      set stale_reason = stale_msg,
          updated_at = now()
      where requirement_id = item.target_id
        and organization_id = item.organization_id;
  end if;

  -- Pricing change: flag HUMAN_APPROVED decisions stale — never clear status/rates
  if item.change_type = 'PRICING_CHANGE' and sol.opportunity_id is not null then
    update public.pricing_decisions
      set stale_reason = stale_msg,
          updated_at = now()
      where opportunity_id = sol.opportunity_id
        and organization_id = item.organization_id;
  end if;

  -- Form add
  if item.change_type = 'FORM_ADDED' then
    after_form := coalesce(item.after_text, item.after_json->>'form_name');
    if after_form is not null and btrim(after_form) <> '' then
      insert into public.required_forms (
        organization_id, solicitation_id, form_name, mandatory, section_ref
      )
      values (
        item.organization_id,
        run.solicitation_id,
        left(btrim(after_form), 200),
        true,
        nullif(item.after_json->>'section_ref', '')
      )
      on conflict (organization_id, solicitation_id, form_name) do nothing;
    end if;
  end if;

  -- Checklist: reset addendum_acknowledgements completed after material apply
  if sol.opportunity_id is not null
     and (
       item.change_type in (
         'DEADLINE_CHANGE', 'REQUIREMENT_ADDED', 'REQUIREMENT_MODIFIED', 'REQUIREMENT_REMOVED',
         'PRICING_CHANGE', 'FORM_ADDED', 'FORM_REMOVED', 'Q_A_CLARIFICATION', 'SCOPE_CHANGE'
       )
       or coalesce((item.impact_flags->>'checklist')::boolean, false)
     ) then
    update public.submission_checklist_items
      set completed = false,
          notes = coalesce(notes, '') || case
            when notes is null or notes = '' then 'Reset: addendum/Q&A change applied ' || item.id::text
            else E'\nReset: addendum/Q&A change applied ' || item.id::text
          end
      where opportunity_id = sol.opportunity_id
        and organization_id = item.organization_id
        and item_key = 'addendum_acknowledgements'
        and completed = true;
  end if;

  update public.solicitation_change_items
    set applied_at = now(),
        applied_by = actor,
        updated_at = now()
    where id = item.id;

  -- Roll up run status when all verified items applied
  if not exists (
    select 1 from public.solicitation_change_items i
    where i.change_run_id = run.id
      and i.verification_status = 'HUMAN_VERIFIED'
      and i.applied_at is null
      and (i.ambiguity_reason is null or btrim(i.ambiguity_reason) = '')
  ) then
    update public.solicitation_change_runs
      set status = 'APPLIED',
          updated_at = now()
      where id = run.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'applied',
    'item_id', item.id,
    'change_type', item.change_type::text,
    'new_requirement_id', new_req_id,
    'note', 'Never sets HUMAN_APPROVED or draft APPROVED. Stale flags only.'
  );
end;
$$;

revoke all on function public.apply_solicitation_change_item(uuid, uuid) from public;
grant execute on function public.apply_solicitation_change_item(uuid, uuid) to authenticated;
