-- F14: Past Performance + Experience Integrity Engine
-- Hard rules (documented + enforced):
--   * NEVER merge experience types.
--   * NEVER turn "person worked Contract Y at prior employer" into "L&P performed Contract Y."
--   * NEVER invent contract value / years of experience.
--   * AI/extraction CANNOT set HUMAN_VERIFIED (requires verified_by + verified_at).
--   * Only HUMAN_VERIFIED L_AND_P_CORPORATE may be used as "L&P past performance."
--   * Subcontractor stays subcontractor; management/personnel stay attributed to person/employer.
--   * Class C / competitor corpus MUST NOT promote as corporate PP.
--   * experience_references alone ≠ corporate past performance.
-- OpenContracts / RFPilot / AutoRFP = pattern only.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.experience_type as enum (
    'L_AND_P_CORPORATE',
    'MANAGEMENT_PRIOR_EXPERIENCE',
    'KEY_PERSONNEL_EXPERIENCE',
    'SUBCONTRACTOR_EXPERIENCE'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.experience_type is
  'Typed experience integrity. Never merge. Only L_AND_P_CORPORATE (HUMAN_VERIFIED) is L&P past performance.';

-- Reuse compliance_verification_status values (same lifecycle).
-- Prefer that enum; if absent, create a local alias type.
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
-- experience_records
-- ---------------------------------------------------------------------------
create table if not exists public.experience_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  experience_type public.experience_type not null,
  person_name text,
  subcontractor_name text,
  buyer_name text,
  buyer_client_id uuid,
  project_or_contract_name text not null,
  contract_number text,
  period_of_performance_start date,
  period_of_performance_end date,
  scope_summary text,
  geography text,
  -- Value ONLY when sourced — never invent.
  contract_value_amount numeric,
  contract_value_currency text default 'USD',
  contract_value_source text,
  -- Years ONLY when sourced — never invent.
  years_of_experience numeric,
  years_source text,
  role_description text,
  performance_result text,
  source_document_id uuid,
  source_document_version_id uuid,
  source_page integer,
  source_fact_id uuid,
  source_url text,
  verification_status public.compliance_verification_status not null default 'AI_EXTRACTED',
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  -- Frozen attribution language — drafting must preserve, never rewrite subject to L&P.
  attribution_language text not null,
  contract_id uuid,
  employer_name text,
  performed_by_org text,
  supersedes_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint experience_records_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint experience_records_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint experience_records_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null,
  constraint experience_records_buyer_client_same_org_fkey
    foreign key (buyer_client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint experience_records_supersedes_same_org_fkey
    foreign key (supersedes_id, organization_id)
    references public.experience_records (id, organization_id)
    on delete set null,
  constraint experience_records_source_document_version_fkey
    foreign key (source_document_version_id)
    references public.document_versions (id)
    on delete set null,
  -- HUMAN_VERIFIED only via human path (verified_by + verified_at). AI cannot satisfy this.
  constraint experience_records_human_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  ),
  -- Sourced value integrity: amount requires a source citation string.
  constraint experience_records_value_requires_source check (
    contract_value_amount is null
    or (contract_value_source is not null and length(trim(contract_value_source)) > 0)
  ),
  -- Sourced years integrity: years requires a source citation string.
  constraint experience_records_years_requires_source check (
    years_of_experience is null
    or (years_source is not null and length(trim(years_source)) > 0)
  ),
  constraint experience_records_attribution_nonblank check (
    length(trim(attribution_language)) > 0
  ),
  -- Attribution integrity by type — NEVER merge subjects.
  constraint experience_records_type_attribution check (
    (
      experience_type = 'L_AND_P_CORPORATE'
      and contract_id is not null
      and person_name is null
      and subcontractor_name is null
      and employer_name is null
      and performed_by_org is not null
      and length(trim(performed_by_org)) > 0
    )
    or (
      experience_type = 'MANAGEMENT_PRIOR_EXPERIENCE'
      and person_name is not null
      and length(trim(person_name)) > 0
      and employer_name is not null
      and length(trim(employer_name)) > 0
      and subcontractor_name is null
    )
    or (
      experience_type = 'KEY_PERSONNEL_EXPERIENCE'
      and person_name is not null
      and length(trim(person_name)) > 0
      and subcontractor_name is null
    )
    or (
      experience_type = 'SUBCONTRACTOR_EXPERIENCE'
      and subcontractor_name is not null
      and length(trim(subcontractor_name)) > 0
      and person_name is null
    )
  )
);

create index if not exists experience_records_org_idx
  on public.experience_records (organization_id, created_at desc);
create index if not exists experience_records_type_idx
  on public.experience_records (organization_id, experience_type);
create index if not exists experience_records_verification_idx
  on public.experience_records (organization_id, verification_status);
create index if not exists experience_records_contract_idx
  on public.experience_records (organization_id, contract_id)
  where contract_id is not null;

comment on table public.experience_records is
  'Typed past performance / experience. Types never merge. Only HUMAN_VERIFIED L_AND_P_CORPORATE is L&P corporate PP.';
comment on column public.experience_records.attribution_language is
  'Frozen subject language. Drafting must preserve; never rewrite prior-employer work as L&P performance.';
comment on column public.experience_records.contract_value_amount is
  'Nullable. Only set when contract_value_source cites evidence — never invent.';
comment on column public.experience_records.years_of_experience is
  'Nullable. Only set when years_source cites evidence — never invent.';
comment on column public.experience_records.performed_by_org is
  'Org that performed the work (L&P for corporate; prior employer for management prior).';

alter table public.experience_records enable row level security;

drop policy if exists experience_records_select on public.experience_records;
create policy experience_records_select on public.experience_records
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists experience_records_insert on public.experience_records;
create policy experience_records_insert on public.experience_records
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists experience_records_update on public.experience_records;
create policy experience_records_update on public.experience_records
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists experience_records_delete on public.experience_records;
create policy experience_records_delete on public.experience_records
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.experience_records to authenticated;

-- ---------------------------------------------------------------------------
-- experience_references (separate — references alone ≠ corporate PP)
-- ---------------------------------------------------------------------------
create table if not exists public.experience_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  experience_record_id uuid not null,
  contact_name text,
  contact_title text,
  contact_phone text,
  contact_email text,
  agency_or_company text,
  notes text,
  source_document_id uuid,
  source_page integer,
  verification_status public.compliance_verification_status not null default 'AI_EXTRACTED',
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint experience_references_record_same_org_fkey
    foreign key (experience_record_id, organization_id)
    references public.experience_records (id, organization_id)
    on delete cascade,
  constraint experience_references_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint experience_references_human_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  )
);

create index if not exists experience_references_org_idx
  on public.experience_references (organization_id, created_at desc);
create index if not exists experience_references_record_idx
  on public.experience_references (organization_id, experience_record_id);

comment on table public.experience_references is
  'Reference contacts for an experience_record. A reference row alone is never L&P corporate past performance.';

alter table public.experience_references enable row level security;

drop policy if exists experience_references_select on public.experience_references;
create policy experience_references_select on public.experience_references
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists experience_references_insert on public.experience_references;
create policy experience_references_insert on public.experience_references
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists experience_references_update on public.experience_references;
create policy experience_references_update on public.experience_references
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists experience_references_delete on public.experience_references;
create policy experience_references_delete on public.experience_references
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.experience_references to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: promote_experience_from_contract → L_AND_P_CORPORATE only
-- Rejects Class C / competitor packages. Never HUMAN_VERIFIED (AI path).
-- ---------------------------------------------------------------------------
create or replace function public.promote_experience_from_contract(p_contract_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_pkg_class public.corpus_class;
  v_buyer text;
  v_attr text;
  v_id uuid;
  v_existing uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Authentication required.');
  end if;

  select * into v_contract
  from public.contracts
  where id = p_contract_id;

  if not found then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Contract not found.');
  end if;

  if not public.is_org_member(v_contract.organization_id) then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Not an organization member.');
  end if;

  -- Class C / competitor corpus must never become L&P corporate past performance.
  select pp.corpus_class into v_pkg_class
  from public.documents d
  left join public.procurement_packages pp
    on pp.id = d.procurement_package_id
   and pp.organization_id = d.organization_id
  where d.id = v_contract.source_document_id
    and d.organization_id = v_contract.organization_id;

  if v_pkg_class = 'C_COMPETITOR_TEST' then
    return jsonb_build_object(
      'ok', false,
      'action', 'skipped',
      'message', 'Class C / competitor corpus cannot promote as L_AND_P_CORPORATE past performance.'
    );
  end if;

  -- Idempotent: one active corporate row per contract (ignore superseded).
  select er.id into v_existing
  from public.experience_records er
  where er.organization_id = v_contract.organization_id
    and er.contract_id = v_contract.id
    and er.experience_type = 'L_AND_P_CORPORATE'
    and not exists (
      select 1 from public.experience_records s
      where s.supersedes_id = er.id
        and s.organization_id = er.organization_id
    )
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true,
      'action', 'exists',
      'experience_record_id', v_existing,
      'message', 'L_AND_P_CORPORATE experience already exists for this contract.'
    );
  end if;

  select c.name into v_buyer
  from public.clients c
  where c.id = v_contract.client_id
    and c.organization_id = v_contract.organization_id;

  v_attr := format(
    'L&P Global Security performed this contract (%s)%s.',
    coalesce(nullif(trim(v_contract.title), ''), 'untitled'),
    case when v_contract.contract_number is not null and length(trim(v_contract.contract_number)) > 0
      then format(' — contract %s', trim(v_contract.contract_number))
      else ''
    end
  );

  insert into public.experience_records (
    organization_id,
    experience_type,
    buyer_name,
    buyer_client_id,
    project_or_contract_name,
    contract_number,
    period_of_performance_start,
    period_of_performance_end,
    source_document_id,
    source_fact_id,
    verification_status,
    verified_by,
    verified_at,
    attribution_language,
    contract_id,
    performed_by_org,
    -- Value and years intentionally left null — never invent from contract row alone.
    contract_value_amount,
    years_of_experience
  ) values (
    v_contract.organization_id,
    'L_AND_P_CORPORATE',
    v_buyer,
    v_contract.client_id,
    v_contract.title,
    v_contract.contract_number,
    v_contract.start_on,
    v_contract.verified_end_on,
    v_contract.source_document_id,
    v_contract.source_fact_id,
    'AI_EXTRACTED',
    null,
    null,
    v_attr,
    v_contract.id,
    'L&P Global Security',
    null,
    null
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'created',
    'experience_record_id', v_id,
    'experience_type', 'L_AND_P_CORPORATE',
    'verification_status', 'AI_EXTRACTED',
    'message', 'Created L_AND_P_CORPORATE experience (AI_EXTRACTED). HUMAN_VERIFIED requires verify.promote.'
  );
end;
$$;

revoke all on function public.promote_experience_from_contract(uuid) from public;
grant execute on function public.promote_experience_from_contract(uuid) to authenticated;

comment on function public.promote_experience_from_contract(uuid) is
  'Promote an L&P-held contract to L_AND_P_CORPORATE experience only. Rejects Class C. Never sets HUMAN_VERIFIED. Never invents value/years.';
