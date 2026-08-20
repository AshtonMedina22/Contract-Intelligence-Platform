-- Phase 9: contract portfolio from verified facts + Supabase Cron buckets.
-- Alerts use verified_end_on only. Vercel Cron is not used here.

create type public.contract_alert_bucket as enum (
  '180',
  '120',
  '90',
  '60',
  '30',
  'EXPIRED'
);

create type public.compliance_kind as enum (
  'insurance',
  'license',
  'certification',
  'other'
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid,
  client_id uuid,
  source_document_id uuid,
  source_fact_id uuid,
  title text not null,
  contract_number text,
  start_on date,
  verified_end_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id),
  constraint contracts_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint contracts_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint contracts_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint contracts_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index contracts_organization_id_idx on public.contracts (organization_id);
create index contracts_verified_end_on_idx on public.contracts (organization_id, verified_end_on);

comment on column public.contracts.verified_end_on is
  'Human-verified expiration. Cron buckets use this date only — never AI_EXTRACTED dates.';

create table public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  note text not null,
  effective_on date,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint contract_amendments_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint contract_amendments_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint contract_amendments_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index contract_amendments_contract_id_idx on public.contract_amendments (contract_id);

create table public.contract_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  source_fact_id uuid,
  label text not null,
  exercise_by date,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint contract_options_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint contract_options_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index contract_options_contract_id_idx on public.contract_options (contract_id);

create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  source_fact_id uuid,
  notice text,
  notice_due_on date,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint renewals_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint renewals_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index renewals_contract_id_idx on public.renewals (contract_id);

create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid,
  source_fact_id uuid,
  kind public.compliance_kind not null default 'other',
  statement text not null,
  expires_on date,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint compliance_items_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null,
  constraint compliance_items_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index compliance_items_organization_id_idx on public.compliance_items (organization_id);
create index compliance_items_expires_on_idx on public.compliance_items (organization_id, expires_on);

create table public.contract_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  bucket public.contract_alert_bucket not null,
  days_until integer not null,
  verified_end_on date not null,
  source_fact_id uuid,
  computed_on timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, contract_id, bucket),
  constraint contract_alerts_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint contract_alerts_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index contract_alerts_bucket_idx on public.contract_alerts (organization_id, bucket);

alter table public.contracts enable row level security;
alter table public.contract_amendments enable row level security;
alter table public.contract_options enable row level security;
alter table public.renewals enable row level security;
alter table public.compliance_items enable row level security;
alter table public.contract_alerts enable row level security;

create policy contracts_all on public.contracts
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy contract_amendments_all on public.contract_amendments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy contract_options_all on public.contract_options
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy renewals_all on public.renewals
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy compliance_items_all on public.compliance_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy contract_alerts_all on public.contract_alerts
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert, update, delete on public.contract_amendments to authenticated;
grant select, insert, update, delete on public.contract_options to authenticated;
grant select, insert, update, delete on public.renewals to authenticated;
grant select, insert, update, delete on public.compliance_items to authenticated;
grant select, insert, update, delete on public.contract_alerts to authenticated;

create or replace function public.parse_iso_date(raw text)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text;
begin
  if raw is null or length(btrim(raw)) = 0 then
    return null;
  end if;
  cleaned := substring(btrim(raw) from '([0-9]{4}-[0-9]{2}-[0-9]{2})');
  if cleaned is null then
    return null;
  end if;
  begin
    return cleaned::date;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.alert_bucket_for_days(days_until integer)
returns public.contract_alert_bucket
language sql
immutable
set search_path = public
as $$
  select case
    when days_until < 0 then 'EXPIRED'::public.contract_alert_bucket
    when days_until <= 30 then '30'::public.contract_alert_bucket
    when days_until <= 60 then '60'::public.contract_alert_bucket
    when days_until <= 90 then '90'::public.contract_alert_bucket
    when days_until <= 120 then '120'::public.contract_alert_bucket
    when days_until <= 180 then '180'::public.contract_alert_bucket
    else null
  end;
$$;

create or replace function public.ensure_contract(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_client_id uuid,
  p_document_id uuid,
  p_fact_id uuid,
  p_title text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing uuid;
begin
  if p_opportunity_id is not null then
    select id into existing
    from public.contracts
    where organization_id = p_organization_id
      and opportunity_id = p_opportunity_id;
  end if;
  if existing is not null then
    return existing;
  end if;
  insert into public.contracts (
    organization_id, opportunity_id, client_id, source_document_id, source_fact_id, title
  )
  values (
    p_organization_id,
    p_opportunity_id,
    p_client_id,
    p_document_id,
    p_fact_id,
    coalesce(nullif(btrim(p_title), ''), 'Contract')
  )
  returning id into existing;
  return existing;
end;
$$;

create or replace function public.promote_contract_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  truth public.commercial_truth;
  field_l text;
  entity_l text;
  value_text text;
  parsed date;
  contract_id uuid;
  kind public.compliance_kind;
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
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'No opportunity on document.');
  end if;

  truth := coalesce(
    doc.commercial_truth,
    public.infer_commercial_truth(doc.document_type, doc.original_filename)
  );
  field_l := lower(coalesce(fact.field, ''));
  entity_l := lower(coalesce(fact.entity, ''));
  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);

  if field_l not in (
    'contract_end', 'expiration_date', 'end_date', 'contract_expiration', 'verified_end_on',
    'contract_start', 'start_date',
    'contract_number', 'contract_title', 'contract_name',
    'insurance_expiration', 'license_expiration', 'certification_expiration',
    'amendment', 'amendment_note',
    'option_exercise_by',
    'renewal_notice', 'renewal_due'
  ) and entity_l not in ('contract', 'amendment', 'renewal', 'compliance') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a contract field.');
  end if;

  if truth is not null and truth not in ('awarded', 'current') then
    insert into public.validation_exceptions (organization_id, document_id, code, message)
    values (
      fact.organization_id,
      fact.document_id,
      'precedence_contract',
      'Contracts come from awarded/current instruments, not ' || truth::text || '.'
    );
    return jsonb_build_object('ok', false, 'action', 'conflict', 'message', 'RFP/proposal sources cannot write contracts.');
  end if;

  contract_id := public.ensure_contract(
    fact.organization_id,
    doc.opportunity_id,
    doc.client_id,
    doc.id,
    fact.id,
    coalesce(
      case when field_l in ('contract_title', 'contract_name') then value_text end,
      doc.original_filename,
      'Contract'
    )
  );

  if field_l in ('contract_end', 'expiration_date', 'end_date', 'contract_expiration', 'verified_end_on') then
    parsed := public.parse_iso_date(value_text);
    if parsed is null then
      return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Could not parse verified end date.');
    end if;
    update public.contracts
      set verified_end_on = parsed,
          source_fact_id = fact.id,
          source_document_id = doc.id,
          updated_at = now()
      where id = contract_id;
    perform public.refresh_contract_alerts();
    return jsonb_build_object('ok', true, 'action', 'contract_end', 'contract_id', contract_id, 'verified_end_on', parsed);
  end if;

  if field_l in ('contract_start', 'start_date') then
    parsed := public.parse_iso_date(value_text);
    update public.contracts
      set start_on = parsed, updated_at = now()
      where id = contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_start', 'contract_id', contract_id);
  end if;

  if field_l = 'contract_number' then
    update public.contracts
      set contract_number = value_text, updated_at = now()
      where id = contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_number', 'contract_id', contract_id);
  end if;

  if field_l in ('contract_title', 'contract_name') then
    update public.contracts
      set title = value_text, updated_at = now()
      where id = contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_title', 'contract_id', contract_id);
  end if;

  if field_l in ('insurance_expiration', 'license_expiration', 'certification_expiration')
     or entity_l = 'compliance' then
    kind := case
      when field_l like 'insurance%' then 'insurance'::public.compliance_kind
      when field_l like 'license%' then 'license'::public.compliance_kind
      when field_l like 'certification%' then 'certification'::public.compliance_kind
      else 'other'::public.compliance_kind
    end;
    insert into public.compliance_items (
      organization_id, contract_id, source_fact_id, kind, statement, expires_on
    )
    values (
      fact.organization_id,
      contract_id,
      fact.id,
      kind,
      value_text,
      public.parse_iso_date(value_text)
    );
    return jsonb_build_object('ok', true, 'action', 'compliance', 'contract_id', contract_id);
  end if;

  if field_l in ('amendment', 'amendment_note') or entity_l = 'amendment' then
    insert into public.contract_amendments (
      organization_id, contract_id, source_document_id, source_fact_id, note
    )
    values (fact.organization_id, contract_id, doc.id, fact.id, value_text);
    return jsonb_build_object('ok', true, 'action', 'amendment', 'contract_id', contract_id);
  end if;

  if field_l = 'option_exercise_by' then
    insert into public.contract_options (
      organization_id, contract_id, source_fact_id, label, exercise_by
    )
    values (fact.organization_id, contract_id, fact.id, coalesce(fact.entity, 'option'), public.parse_iso_date(value_text));
    return jsonb_build_object('ok', true, 'action', 'option', 'contract_id', contract_id);
  end if;

  if field_l in ('renewal_notice', 'renewal_due') or entity_l = 'renewal' then
    insert into public.renewals (
      organization_id, contract_id, source_fact_id, notice, notice_due_on
    )
    values (fact.organization_id, contract_id, fact.id, value_text, public.parse_iso_date(value_text));
    return jsonb_build_object('ok', true, 'action', 'renewal', 'contract_id', contract_id);
  end if;

  return jsonb_build_object('ok', true, 'action', 'skipped');
end;
$$;

create schema if not exists private;

create or replace function private.refresh_contract_alerts()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  written integer := 0;
begin
  insert into public.contract_alerts (
    organization_id, contract_id, bucket, days_until, verified_end_on, source_fact_id, computed_on
  )
  select
    c.organization_id,
    c.id,
    public.alert_bucket_for_days((c.verified_end_on - current_date)),
    (c.verified_end_on - current_date),
    c.verified_end_on,
    c.source_fact_id,
    now()
  from public.contracts c
  where c.verified_end_on is not null
    and public.alert_bucket_for_days((c.verified_end_on - current_date)) is not null
  on conflict (organization_id, contract_id, bucket)
  do update set
    days_until = excluded.days_until,
    verified_end_on = excluded.verified_end_on,
    source_fact_id = excluded.source_fact_id,
    computed_on = excluded.computed_on;

  get diagnostics written = row_count;

  delete from public.contract_alerts a
  using public.contracts c
  where a.contract_id = c.id
    and a.organization_id = c.organization_id
    and (
      c.verified_end_on is null
      or a.bucket is distinct from public.alert_bucket_for_days((c.verified_end_on - current_date))
    );

  return written;
end;
$$;

create or replace function public.refresh_contract_alerts()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  written integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.contract_alerts (
    organization_id, contract_id, bucket, days_until, verified_end_on, source_fact_id, computed_on
  )
  select
    c.organization_id,
    c.id,
    public.alert_bucket_for_days((c.verified_end_on - current_date)),
    (c.verified_end_on - current_date),
    c.verified_end_on,
    c.source_fact_id,
    now()
  from public.contracts c
  where c.verified_end_on is not null
    and public.is_org_member(c.organization_id)
    and public.alert_bucket_for_days((c.verified_end_on - current_date)) is not null
  on conflict (organization_id, contract_id, bucket)
  do update set
    days_until = excluded.days_until,
    verified_end_on = excluded.verified_end_on,
    source_fact_id = excluded.source_fact_id,
    computed_on = excluded.computed_on;

  get diagnostics written = row_count;

  delete from public.contract_alerts a
  using public.contracts c
  where a.contract_id = c.id
    and a.organization_id = c.organization_id
    and public.is_org_member(c.organization_id)
    and (
      c.verified_end_on is null
      or a.bucket is distinct from public.alert_bucket_for_days((c.verified_end_on - current_date))
    );

  return written;
end;
$$;

revoke all on function private.refresh_contract_alerts() from public;
revoke all on function private.refresh_contract_alerts() from anon;
revoke all on function private.refresh_contract_alerts() from authenticated;
grant execute on function private.refresh_contract_alerts() to postgres;

revoke all on function public.parse_iso_date(text) from public;
revoke all on function public.alert_bucket_for_days(integer) from public;
revoke all on function public.ensure_contract(uuid, uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.promote_contract_from_fact(uuid) from public;
revoke all on function public.refresh_contract_alerts() from public;

grant execute on function public.parse_iso_date(text) to authenticated;
grant execute on function public.alert_bucket_for_days(integer) to authenticated;
grant execute on function public.ensure_contract(uuid, uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.promote_contract_from_fact(uuid) to authenticated;
grant execute on function public.refresh_contract_alerts() to authenticated;

do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron not available in this environment: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid)
    from cron.job j
    where j.jobname = 'refresh-contract-alerts';
    perform cron.schedule(
      'refresh-contract-alerts',
      '15 6 * * *',
      $cron$select private.refresh_contract_alerts();$cron$
    );
  end if;
exception
  when others then
    raise notice 'cron.schedule skipped: %', sqlerrm;
end $$;
