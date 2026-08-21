-- F15 — Contract Obligations + Deliverables + Performance Compliance Engine
-- Hard rules:
--   * NOT a generic task manager — contract-scoped obligations only.
--   * AI cannot auto-verify or auto-complete obligations.
--   * Never rewrite obligation history — amendments supersede via new row.
--   * Lazy recurrence (next_due_on) — no infinite occurrences table.
--   * Reuse F9: extend private.run_intelligence_automation only; NO second scheduler.
--   * Alerts fire only for HUMAN_VERIFIED obligations (factual overdue/due).
--   * Completion evidence ≠ qualitative past-performance claims (F14).
-- Public-Sector CLM / Whereas / OpenContracts = pattern only.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.obligation_type as enum (
    'STAFFING',
    'SCHEDULE',
    'TRAINING',
    'REPORTING',
    'INCIDENT_REPORTING',
    'INSURANCE',
    'LICENSE',
    'EQUIPMENT',
    'INVOICE',
    'SERVICE_LEVEL',
    'MEETING',
    'AUDIT',
    'DELIVERABLE',
    'NOTICE',
    'OPTION',
    'RENEWAL',
    'OTHER'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.obligation_type is
  'Contract-specific obligation kinds. Not a generic task taxonomy.';

do $$
begin
  create type public.obligation_status as enum (
    'NOT_STARTED',
    'UPCOMING',
    'DUE',
    'COMPLETED',
    'OVERDUE',
    'WAIVED',
    'SUPERSEDED'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.obligation_status is
  'Operational status. Date-derived for open rows; COMPLETED/WAIVED/SUPERSEDED are human terminal.';

do $$
begin
  create type public.obligation_criticality as enum (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
  );
exception
  when duplicate_object then null;
end $$;

-- Reuse compliance_verification_status (AI_EXTRACTED … HUMAN_VERIFIED).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_verification_status') then
    create type public.compliance_verification_status as enum (
      'AI_EXTRACTED',
      'PUBLIC_UNVERIFIED',
      'HUMAN_VERIFIED',
      'REJECTED',
      'NEEDS_REVIEW'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers: date→status + lazy recurrence advance
-- ---------------------------------------------------------------------------
create or replace function public.derive_obligation_status(
  p_status public.obligation_status,
  p_effective_on date,
  p_due_on date,
  p_next_due_on date,
  p_as_of date default current_date,
  p_due_soon_days integer default 7
)
returns public.obligation_status
language plpgsql
immutable
as $$
declare
  v_due date;
  v_days integer;
begin
  -- Terminal human states never date-derived.
  if p_status in ('COMPLETED', 'WAIVED', 'SUPERSEDED') then
    return p_status;
  end if;

  if p_effective_on is not null and p_as_of < p_effective_on then
    return 'NOT_STARTED';
  end if;

  v_due := coalesce(p_next_due_on, p_due_on);
  if v_due is null then
    return 'NOT_STARTED';
  end if;

  v_days := (v_due - p_as_of);
  if v_days < 0 then
    return 'OVERDUE';
  end if;
  if v_days <= greatest(coalesce(p_due_soon_days, 7), 0) then
    return 'DUE';
  end if;
  return 'UPCOMING';
end;
$$;

revoke all on function public.derive_obligation_status(public.obligation_status, date, date, date, date, integer) from public;
grant execute on function public.derive_obligation_status(public.obligation_status, date, date, date, date, integer) to authenticated, service_role;

comment on function public.derive_obligation_status is
  'Pure date→status for open obligations. Terminal COMPLETED/WAIVED/SUPERSEDED preserved.';

create or replace function public.advance_obligation_next_due(
  p_recurrence_rule text,
  p_from date
)
returns date
language plpgsql
immutable
as $$
declare
  v_rule text := upper(nullif(btrim(coalesce(p_recurrence_rule, '')), ''));
begin
  if p_from is null or v_rule is null then
    return null;
  end if;
  if v_rule in ('MONTHLY', 'FREQ=MONTHLY') then
    return (p_from + interval '1 month')::date;
  end if;
  if v_rule in ('WEEKLY', 'FREQ=WEEKLY') then
    return (p_from + interval '7 days')::date;
  end if;
  if v_rule in ('QUARTERLY', 'FREQ=QUARTERLY') then
    return (p_from + interval '3 months')::date;
  end if;
  if v_rule in ('YEARLY', 'ANNUALLY', 'FREQ=YEARLY') then
    return (p_from + interval '1 year')::date;
  end if;
  -- Unknown / one-shot token → no advance
  return null;
end;
$$;

revoke all on function public.advance_obligation_next_due(text, date) from public;
grant execute on function public.advance_obligation_next_due(text, date) to authenticated, service_role;

comment on function public.advance_obligation_next_due is
  'Lazy recurrence: advance next_due_on by rule. No occurrences table.';

-- ---------------------------------------------------------------------------
-- contract_obligations
-- ---------------------------------------------------------------------------
create table if not exists public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  obligation_type public.obligation_type not null default 'OTHER',
  title text not null,
  description text,
  -- Source clause / document provenance (OpenContracts pattern)
  source_clause_ref text,
  source_document_id uuid,
  source_document_version_id uuid,
  source_page integer,
  source_fact_id uuid,
  owner_user_id uuid references auth.users (id) on delete set null,
  effective_on date,
  due_on date,
  -- Lazy recurrence — store rule + next_due_on only (no occurrence rows)
  recurrence_rule text,
  next_due_on date,
  status public.obligation_status not null default 'NOT_STARTED',
  criticality public.obligation_criticality not null default 'MEDIUM',
  evidence_requirement_text text,
  -- Completion evidence document (separate from F14 past-performance claims)
  completion_evidence_document_id uuid,
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  waive_reason text,
  superseded_by_id uuid,
  amendment_id uuid,
  verification_status public.compliance_verification_status not null default 'AI_EXTRACTED',
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint contract_obligations_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint contract_obligations_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint contract_obligations_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint contract_obligations_completion_doc_same_org_fkey
    foreign key (completion_evidence_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint contract_obligations_source_document_version_fkey
    foreign key (source_document_version_id)
    references public.document_versions (id)
    on delete set null,
  constraint contract_obligations_superseded_by_same_org_fkey
    foreign key (superseded_by_id, organization_id)
    references public.contract_obligations (id, organization_id)
    on delete set null,
  constraint contract_obligations_amendment_same_org_fkey
    foreign key (amendment_id, organization_id)
    references public.contract_amendments (id, organization_id)
    on delete set null,
  constraint contract_obligations_title_nonblank check (length(trim(title)) > 0),
  -- HUMAN_VERIFIED only via human path (verified_by + verified_at). AI cannot satisfy this.
  constraint contract_obligations_human_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  ),
  -- COMPLETED requires human actor + timestamp (AI cannot auto-complete).
  constraint contract_obligations_completed_requires_actor check (
    status <> 'COMPLETED'
    or (completed_by is not null and completed_at is not null)
  ),
  -- WAIVED requires reason + not auto.
  constraint contract_obligations_waived_requires_reason check (
    status <> 'WAIVED'
    or (waive_reason is not null and length(trim(waive_reason)) > 0)
  )
);

create index if not exists contract_obligations_org_idx
  on public.contract_obligations (organization_id, created_at desc);
create index if not exists contract_obligations_contract_idx
  on public.contract_obligations (organization_id, contract_id);
create index if not exists contract_obligations_status_idx
  on public.contract_obligations (organization_id, status);
create index if not exists contract_obligations_verification_idx
  on public.contract_obligations (organization_id, verification_status);
create index if not exists contract_obligations_next_due_idx
  on public.contract_obligations (organization_id, next_due_on)
  where next_due_on is not null
    and status not in ('COMPLETED', 'WAIVED', 'SUPERSEDED');

comment on table public.contract_obligations is
  'Contract-scoped obligations / deliverables. Not a generic task manager. AI cannot auto-verify or auto-complete.';
comment on column public.contract_obligations.recurrence_rule is
  'Lazy recurrence token (MONTHLY/WEEKLY/QUARTERLY/YEARLY). No infinite occurrences table.';
comment on column public.contract_obligations.next_due_on is
  'Next due for recurring obligations; coalesce with due_on for one-time.';
comment on column public.contract_obligations.completion_evidence_document_id is
  'Evidence that the obligation was performed — distinct from F14 qualitative past-performance claims.';
comment on column public.contract_obligations.verification_status is
  'Default AI_EXTRACTED. HUMAN_VERIFIED requires verified_by + verified_at (verify.promote).';
comment on column public.contract_obligations.superseded_by_id is
  'Amendment supersession pointer. Prior row kept; history never rewritten in place.';

alter table public.contract_obligations enable row level security;

drop policy if exists contract_obligations_select on public.contract_obligations;
create policy contract_obligations_select on public.contract_obligations
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists contract_obligations_insert on public.contract_obligations;
create policy contract_obligations_insert on public.contract_obligations
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists contract_obligations_update on public.contract_obligations;
create policy contract_obligations_update on public.contract_obligations
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists contract_obligations_delete on public.contract_obligations;
create policy contract_obligations_delete on public.contract_obligations
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.contract_obligations to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: refuse AI HUMAN_VERIFIED / auto-complete
-- ---------------------------------------------------------------------------
create or replace function public.contract_obligations_refuse_ai()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status = 'HUMAN_VERIFIED' then
    if new.verified_by is null or new.verified_at is null then
      raise exception
        'HUMAN_VERIFIED on contract_obligations requires verified_by + verified_at (human verify.promote only; AI cannot set)';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.verification_status = 'HUMAN_VERIFIED'
     and old.verification_status is distinct from 'HUMAN_VERIFIED'
     and new.verified_by is null then
    raise exception 'Cannot promote to HUMAN_VERIFIED without verified_by';
  end if;

  if new.status = 'COMPLETED' then
    if new.completed_by is null or new.completed_at is null then
      raise exception
        'COMPLETED on contract_obligations requires completed_by + completed_at (AI cannot auto-complete)';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'COMPLETED'
     and old.status is distinct from 'COMPLETED'
     and new.completed_by is null then
    raise exception 'Cannot complete obligation without completed_by';
  end if;

  -- Keep status consistent with dates for non-terminal rows on write.
  if new.status not in ('COMPLETED', 'WAIVED', 'SUPERSEDED') then
    new.status := public.derive_obligation_status(
      new.status,
      new.effective_on,
      new.due_on,
      new.next_due_on,
      current_date,
      7
    );
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contract_obligations_refuse_ai on public.contract_obligations;
create trigger contract_obligations_refuse_ai
  before insert or update on public.contract_obligations
  for each row execute function public.contract_obligations_refuse_ai();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Promote candidate → AI_EXTRACTED only (never HUMAN_VERIFIED / COMPLETED)
create or replace function public.promote_obligation_candidate(
  p_contract_id uuid,
  p_obligation_type public.obligation_type,
  p_title text,
  p_description text default null,
  p_source_clause_ref text default null,
  p_source_document_id uuid default null,
  p_source_page integer default null,
  p_source_fact_id uuid default null,
  p_due_on date default null,
  p_effective_on date default null,
  p_recurrence_rule text default null,
  p_criticality public.obligation_criticality default 'MEDIUM',
  p_evidence_requirement_text text default null,
  p_owner_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_id uuid;
  v_next date;
  v_status public.obligation_status;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Authentication required.');
  end if;

  select * into v_contract from public.contracts where id = p_contract_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Contract not found.');
  end if;
  if not public.is_org_member(v_contract.organization_id) then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Not an organization member.');
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Title required.');
  end if;

  v_next := case
    when nullif(btrim(coalesce(p_recurrence_rule, '')), '') is not null then coalesce(p_due_on, p_effective_on)
    else p_due_on
  end;
  v_status := public.derive_obligation_status(
    'NOT_STARTED', p_effective_on, p_due_on, v_next, current_date, 7
  );

  insert into public.contract_obligations (
    organization_id,
    contract_id,
    obligation_type,
    title,
    description,
    source_clause_ref,
    source_document_id,
    source_page,
    source_fact_id,
    owner_user_id,
    effective_on,
    due_on,
    recurrence_rule,
    next_due_on,
    status,
    criticality,
    evidence_requirement_text,
    verification_status,
    verified_by,
    verified_at
  ) values (
    v_contract.organization_id,
    v_contract.id,
    coalesce(p_obligation_type, 'OTHER'),
    trim(p_title),
    p_description,
    p_source_clause_ref,
    coalesce(p_source_document_id, v_contract.source_document_id),
    p_source_page,
    coalesce(p_source_fact_id, v_contract.source_fact_id),
    p_owner_user_id,
    p_effective_on,
    p_due_on,
    nullif(btrim(coalesce(p_recurrence_rule, '')), ''),
    v_next,
    v_status,
    coalesce(p_criticality, 'MEDIUM'),
    p_evidence_requirement_text,
    'AI_EXTRACTED',
    null,
    null
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'created',
    'obligation_id', v_id,
    'verification_status', 'AI_EXTRACTED',
    'status', v_status,
    'message', 'Promoted AI_EXTRACTED obligation. HUMAN_VERIFIED requires verify.promote.'
  );
end;
$$;

revoke all on function public.promote_obligation_candidate(
  uuid, public.obligation_type, text, text, text, uuid, integer, uuid, date, date, text,
  public.obligation_criticality, text, uuid
) from public;
grant execute on function public.promote_obligation_candidate(
  uuid, public.obligation_type, text, text, text, uuid, integer, uuid, date, date, text,
  public.obligation_criticality, text, uuid
) to authenticated;

comment on function public.promote_obligation_candidate is
  'Insert candidate obligation as AI_EXTRACTED only. Never HUMAN_VERIFIED or COMPLETED.';

-- Verify → HUMAN_VERIFIED (actor + timestamp required)
create or replace function public.verify_contract_obligation(p_obligation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contract_obligations%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Authentication required.');
  end if;

  select * into v_row from public.contract_obligations where id = p_obligation_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Obligation not found.');
  end if;
  if not public.is_org_member(v_row.organization_id) then
    return jsonb_build_object('ok', false, 'message', 'Not an organization member.');
  end if;
  if v_row.verification_status = 'REJECTED' then
    return jsonb_build_object('ok', false, 'message', 'Rejected obligations cannot be verified.');
  end if;
  if v_row.status = 'SUPERSEDED' then
    return jsonb_build_object('ok', false, 'message', 'Superseded obligations cannot be verified.');
  end if;
  if v_row.source_document_id is null and v_row.source_fact_id is null and v_row.source_clause_ref is null then
    return jsonb_build_object('ok', false, 'message', 'HUMAN_VERIFIED requires source evidence (clause, document, or fact).');
  end if;

  update public.contract_obligations
  set
    verification_status = 'HUMAN_VERIFIED',
    verified_by = v_uid,
    verified_at = now()
  where id = p_obligation_id
    and organization_id = v_row.organization_id;

  return jsonb_build_object(
    'ok', true,
    'obligation_id', p_obligation_id,
    'verification_status', 'HUMAN_VERIFIED',
    'verified_by', v_uid
  );
end;
$$;

revoke all on function public.verify_contract_obligation(uuid) from public;
grant execute on function public.verify_contract_obligation(uuid) to authenticated;

comment on function public.verify_contract_obligation is
  'Human verify.promote path. Sets HUMAN_VERIFIED with actor + timestamp. AI cannot call meaningfully without auth.';

-- Complete (+ evidence). Recurring → advance next_due_on (lazy); one-time → COMPLETED.
create or replace function public.complete_contract_obligation(
  p_obligation_id uuid,
  p_evidence_document_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contract_obligations%rowtype;
  v_next date;
  v_status public.obligation_status;
  v_doc_org uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Authentication required.');
  end if;
  if p_evidence_document_id is null then
    return jsonb_build_object('ok', false, 'message', 'Completion requires completion_evidence_document_id.');
  end if;

  select * into v_row from public.contract_obligations where id = p_obligation_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Obligation not found.');
  end if;
  if not public.is_org_member(v_row.organization_id) then
    return jsonb_build_object('ok', false, 'message', 'Not an organization member.');
  end if;
  if v_row.status in ('WAIVED', 'SUPERSEDED') then
    return jsonb_build_object('ok', false, 'message', 'Cannot complete a waived or superseded obligation.');
  end if;
  if v_row.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'message', 'Only HUMAN_VERIFIED obligations may be completed.');
  end if;

  select d.organization_id into v_doc_org
  from public.documents d
  where d.id = p_evidence_document_id;
  if v_doc_org is null or v_doc_org is distinct from v_row.organization_id then
    return jsonb_build_object('ok', false, 'message', 'Evidence document must belong to the same organization.');
  end if;

  if nullif(btrim(coalesce(v_row.recurrence_rule, '')), '') is not null then
    v_next := public.advance_obligation_next_due(
      v_row.recurrence_rule,
      coalesce(v_row.next_due_on, v_row.due_on, current_date)
    );
    if v_next is null then
      return jsonb_build_object('ok', false, 'message', 'Unknown recurrence_rule; cannot advance next_due_on.');
    end if;
    v_status := public.derive_obligation_status(
      'NOT_STARTED', v_row.effective_on, v_row.due_on, v_next, current_date, 7
    );
    update public.contract_obligations
    set
      completion_evidence_document_id = p_evidence_document_id,
      completed_at = now(),
      completed_by = v_uid,
      next_due_on = v_next,
      status = v_status
    where id = p_obligation_id
      and organization_id = v_row.organization_id;

    return jsonb_build_object(
      'ok', true,
      'action', 'recurring_advanced',
      'obligation_id', p_obligation_id,
      'next_due_on', v_next,
      'status', v_status,
      'message', 'Recorded completion evidence and advanced next_due_on (lazy recurrence).'
    );
  end if;

  update public.contract_obligations
  set
    completion_evidence_document_id = p_evidence_document_id,
    completed_at = now(),
    completed_by = v_uid,
    status = 'COMPLETED'
  where id = p_obligation_id
    and organization_id = v_row.organization_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'completed',
    'obligation_id', p_obligation_id,
    'status', 'COMPLETED',
    'message', 'One-time obligation completed with evidence.'
  );
end;
$$;

revoke all on function public.complete_contract_obligation(uuid, uuid) from public;
grant execute on function public.complete_contract_obligation(uuid, uuid) to authenticated;

comment on function public.complete_contract_obligation is
  'Human complete with evidence document. Recurring advances next_due_on; one-time → COMPLETED. AI cannot auto-complete.';

-- Waive
create or replace function public.waive_contract_obligation(
  p_obligation_id uuid,
  p_waive_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contract_obligations%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Authentication required.');
  end if;
  if p_waive_reason is null or length(trim(p_waive_reason)) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Waive reason required.');
  end if;

  select * into v_row from public.contract_obligations where id = p_obligation_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Obligation not found.');
  end if;
  if not public.is_org_member(v_row.organization_id) then
    return jsonb_build_object('ok', false, 'message', 'Not an organization member.');
  end if;
  if v_row.status = 'SUPERSEDED' then
    return jsonb_build_object('ok', false, 'message', 'Cannot waive a superseded obligation.');
  end if;

  update public.contract_obligations
  set
    status = 'WAIVED',
    waive_reason = trim(p_waive_reason),
    completed_at = coalesce(completed_at, now()),
    completed_by = coalesce(completed_by, v_uid)
  where id = p_obligation_id
    and organization_id = v_row.organization_id;

  return jsonb_build_object(
    'ok', true,
    'obligation_id', p_obligation_id,
    'status', 'WAIVED',
    'waive_reason', trim(p_waive_reason)
  );
end;
$$;

revoke all on function public.waive_contract_obligation(uuid, text) from public;
grant execute on function public.waive_contract_obligation(uuid, text) to authenticated;

comment on function public.waive_contract_obligation is
  'Human waiver with required reason. Does not delete history.';

-- Supersede from amendment — never rewrite prior row; insert new + point superseded_by_id
create or replace function public.supersede_obligation_from_amendment(
  p_obligation_id uuid,
  p_amendment_id uuid,
  p_title text default null,
  p_description text default null,
  p_due_on date default null,
  p_obligation_type public.obligation_type default null,
  p_source_clause_ref text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contract_obligations%rowtype;
  v_amd public.contract_amendments%rowtype;
  v_new_id uuid;
  v_next date;
  v_status public.obligation_status;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Authentication required.');
  end if;

  select * into v_row from public.contract_obligations where id = p_obligation_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Obligation not found.');
  end if;
  if not public.is_org_member(v_row.organization_id) then
    return jsonb_build_object('ok', false, 'message', 'Not an organization member.');
  end if;
  if v_row.status = 'SUPERSEDED' then
    return jsonb_build_object('ok', false, 'message', 'Obligation already superseded.');
  end if;

  select * into v_amd
  from public.contract_amendments
  where id = p_amendment_id
    and organization_id = v_row.organization_id
    and contract_id = v_row.contract_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Amendment not found for this contract/org.');
  end if;

  v_next := coalesce(p_due_on, v_row.next_due_on, v_row.due_on);
  v_status := public.derive_obligation_status(
    'NOT_STARTED',
    v_row.effective_on,
    coalesce(p_due_on, v_row.due_on),
    v_next,
    current_date,
    7
  );

  -- Insert successor first (history preserved on prior row).
  insert into public.contract_obligations (
    organization_id,
    contract_id,
    obligation_type,
    title,
    description,
    source_clause_ref,
    source_document_id,
    source_document_version_id,
    source_page,
    source_fact_id,
    owner_user_id,
    effective_on,
    due_on,
    recurrence_rule,
    next_due_on,
    status,
    criticality,
    evidence_requirement_text,
    amendment_id,
    verification_status,
    verified_by,
    verified_at
  ) values (
    v_row.organization_id,
    v_row.contract_id,
    coalesce(p_obligation_type, v_row.obligation_type),
    coalesce(nullif(trim(p_title), ''), v_row.title),
    coalesce(p_description, v_row.description),
    coalesce(p_source_clause_ref, v_row.source_clause_ref),
    coalesce(v_amd.source_document_id, v_row.source_document_id),
    v_row.source_document_version_id,
    v_row.source_page,
    coalesce(v_amd.source_fact_id, v_row.source_fact_id),
    v_row.owner_user_id,
    coalesce(v_amd.effective_on, v_row.effective_on),
    coalesce(p_due_on, v_row.due_on),
    v_row.recurrence_rule,
    v_next,
    v_status,
    v_row.criticality,
    v_row.evidence_requirement_text,
    p_amendment_id,
    'AI_EXTRACTED',
    null,
    null
  )
  returning id into v_new_id;

  -- Mark prior SUPERSEDED (do not rewrite title/description/dates in place).
  update public.contract_obligations
  set
    status = 'SUPERSEDED',
    superseded_by_id = v_new_id,
    amendment_id = coalesce(amendment_id, p_amendment_id)
  where id = p_obligation_id
    and organization_id = v_row.organization_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'superseded',
    'prior_obligation_id', p_obligation_id,
    'new_obligation_id', v_new_id,
    'amendment_id', p_amendment_id,
    'message', 'Prior obligation SUPERSEDED; successor inserted. History not rewritten.'
  );
end;
$$;

revoke all on function public.supersede_obligation_from_amendment(
  uuid, uuid, text, text, date, public.obligation_type, text
) from public;
grant execute on function public.supersede_obligation_from_amendment(
  uuid, uuid, text, text, date, public.obligation_type, text
) to authenticated;

comment on function public.supersede_obligation_from_amendment is
  'Amendment supersession: insert new row, mark prior SUPERSEDED. Never rewrite obligation history.';

-- ---------------------------------------------------------------------------
-- F9 refreshers — HUMAN_VERIFIED only; extend same orchestrator (no second cron)
-- ---------------------------------------------------------------------------
create or replace function private.refresh_obligation_due_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  days integer;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
  v_due date;
begin
  for r in
    select o.id, o.organization_id, o.contract_id, o.title, o.due_on, o.next_due_on, o.owner_user_id
    from public.contract_obligations o
    where o.verification_status = 'HUMAN_VERIFIED'
      and o.status not in ('COMPLETED', 'WAIVED', 'SUPERSEDED')
      and coalesce(o.next_due_on, o.due_on) is not null
  loop
    v_due := coalesce(r.next_due_on, r.due_on);
    days := (v_due - current_date);
    -- Due window: today through +7 days (not yet overdue)
    if days < 0 or days > 7 then
      continue;
    end if;
    v_key := 'obligation_due:' || r.id::text || ':' || v_due::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'obligation_due',
      'contract_obligation',
      r.id,
      case when days = 0 then 'high' else 'medium' end,
      format('Obligation due %s — %s', v_due, left(coalesce(r.title, 'obligation'), 80)),
      'HUMAN_VERIFIED contract obligation due soon. Automation never auto-completes or verifies.',
      v_due,
      v_key,
      '/contracts/' || r.contract_id::text || '/obligations',
      r.owner_user_id
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('obligation_due', keys);
  return n;
end;
$$;

create or replace function private.refresh_obligation_overdue_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  days integer;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
  v_due date;
begin
  for r in
    select o.id, o.organization_id, o.contract_id, o.title, o.due_on, o.next_due_on, o.owner_user_id
    from public.contract_obligations o
    where o.verification_status = 'HUMAN_VERIFIED'
      and o.status not in ('COMPLETED', 'WAIVED', 'SUPERSEDED')
      and coalesce(o.next_due_on, o.due_on) is not null
  loop
    v_due := coalesce(r.next_due_on, r.due_on);
    days := (v_due - current_date);
    if days >= 0 then
      continue;
    end if;
    v_key := 'obligation_overdue:' || r.id::text || ':' || v_due::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'obligation_overdue',
      'contract_obligation',
      r.id,
      'critical',
      format('Obligation overdue since %s — %s', v_due, left(coalesce(r.title, 'obligation'), 80)),
      'HUMAN_VERIFIED contract obligation overdue. Automation never auto-completes, waives, or verifies.',
      v_due,
      v_key,
      '/contracts/' || r.contract_id::text || '/obligations',
      r.owner_user_id
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('obligation_overdue', keys);
  return n;
end;
$$;

revoke all on function private.refresh_obligation_due_alerts() from public, anon, authenticated;
revoke all on function private.refresh_obligation_overdue_alerts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Orchestrator — SAME function + SAME cron job (no second scheduler)
-- ---------------------------------------------------------------------------
create or replace function private.run_intelligence_automation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_n integer := 0;
  pursuit_n integer := 0;
  questions_n integer := 0;
  conference_n integer := 0;
  pricing_n integer := 0;
  approval_n integer := 0;
  lp_n integer := 0;
  mandatory_n integer := 0;
  checklist_n integer := 0;
  verify_n integer := 0;
  failure_n integer := 0;
  compliance_n integer := 0;
  review_n integer := 0;
  renewal_n integer := 0;
  rebid_n integer := 0;
  option_n integer := 0;
  research_n integer := 0;
  obligation_due_n integer := 0;
  obligation_overdue_n integer := 0;
begin
  begin
    perform private.refresh_contract_alerts();
    contract_n := 1;
  exception when undefined_function then
    contract_n := 0;
  end;

  pursuit_n := private.refresh_pursuit_deadline_alerts();
  questions_n := private.refresh_questions_deadline_alerts();
  conference_n := private.refresh_conference_prebid_alerts();

  begin
    pricing_n := private.refresh_pricing_approval_alerts();
  exception when undefined_table then
    pricing_n := 0;
  end;

  begin
    approval_n := private.refresh_approval_reminder_alerts();
  exception when undefined_function then
    approval_n := 0;
  end;

  begin
    lp_n := private.refresh_lp_input_required_alerts();
  exception when undefined_table then
    lp_n := 0;
  end;

  begin
    mandatory_n := private.refresh_mandatory_requirement_alerts();
  exception when undefined_table then
    mandatory_n := 0;
  end;

  begin
    checklist_n := private.refresh_submission_checklist_alerts();
  exception when undefined_table then
    checklist_n := 0;
  end;

  verify_n := private.refresh_verification_backlog_alerts();
  failure_n := private.refresh_processing_failure_alerts();

  begin
    compliance_n := private.refresh_compliance_expiration_alerts();
  exception when undefined_table then
    compliance_n := 0;
  end;

  begin
    review_n := private.refresh_contract_review_window_alerts();
  exception when undefined_table then
    review_n := 0;
  end;

  begin
    renewal_n := private.refresh_renewal_notice_alerts();
  exception when undefined_table then
    renewal_n := 0;
  end;

  begin
    rebid_n := private.refresh_rebid_planning_alerts();
  exception when undefined_table then
    rebid_n := 0;
  end;

  begin
    option_n := private.refresh_option_decision_alerts();
  exception when undefined_table then
    option_n := 0;
  end;

  begin
    research_n := private.refresh_research_refresh_alerts();
  exception when undefined_table then
    research_n := 0;
  end;

  -- F15: obligation due / overdue (HUMAN_VERIFIED only inside refreshers)
  begin
    obligation_due_n := private.refresh_obligation_due_alerts();
  exception when undefined_table then
    obligation_due_n := 0;
  end;

  begin
    obligation_overdue_n := private.refresh_obligation_overdue_alerts();
  exception when undefined_table then
    obligation_overdue_n := 0;
  end;

  return jsonb_build_object(
    'ok', true,
    'contract_alerts', contract_n,
    'pursuit_deadlines', pursuit_n,
    'questions_deadlines', questions_n,
    'conference_prebid', conference_n,
    'pricing_approval', pricing_n,
    'response_approval', approval_n,
    'lp_input_required', lp_n,
    'mandatory_requirements', mandatory_n,
    'submission_checklist', checklist_n,
    'verification_backlog', verify_n,
    'processing_failure', failure_n,
    'compliance', compliance_n,
    'contract_review_window', review_n,
    'renewal_notice', renewal_n,
    'rebid_planning', rebid_n,
    'option_decision', option_n,
    'research_refresh', research_n,
    'obligation_due', obligation_due_n,
    'obligation_overdue', obligation_overdue_n,
    'note', 'No human gates bypassed — never verify/price/approve/submit/renew/exercise/complete-obligations'
  );
end;
$$;

revoke all on function private.run_intelligence_automation() from public, anon, authenticated;

-- Confirm existing cron job name only (re-schedule same job; no second job)
do $$
begin
  perform cron.unschedule('intelligence-automation-daily');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule(
    'intelligence-automation-daily',
    '15 6 * * *',
    $cron$select private.run_intelligence_automation();$cron$
  );
exception when others then
  raise notice 'cron.schedule intelligence-automation-daily skipped: %', sqlerrm;
end $$;
