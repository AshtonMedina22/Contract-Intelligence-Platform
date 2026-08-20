-- Canonical Phase 6 — purpose-aware retrieval + bounded automation events.
-- Evidence: MASTER_BLUEPRINT Ask/Reports/Automation; Prompt 6.

do $$
begin
  create type public.retrieval_purpose as enum (
    'GENERAL_QA',
    'LOCATE',
    'LOSS_ANALYSIS',
    'COMPETITOR_ANALYSIS',
    'PRICING_ANALYSIS',
    'BID_STRATEGY',
    'PROPOSAL_DRAFTING',
    'COMPLIANCE_REVIEW',
    'REPORT_GENERATION'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.retrieval_purpose is
  'Retrieval purpose gates reuse/version filters. PROPOSAL_DRAFTING never includes DO_NOT_USE.';

-- True when purpose may retrieve DO_NOT_USE chunks (retrospective only).
create or replace function public.purpose_allows_do_not_use(p_purpose public.retrieval_purpose)
returns boolean
language sql
immutable
as $$
  select p_purpose in (
    'LOSS_ANALYSIS'::public.retrieval_purpose,
    'COMPETITOR_ANALYSIS'::public.retrieval_purpose,
    'LOCATE'::public.retrieval_purpose
  );
$$;

create or replace function public.purpose_requires_drafting_gates(p_purpose public.retrieval_purpose)
returns boolean
language sql
immutable
as $$
  select p_purpose = 'PROPOSAL_DRAFTING'::public.retrieval_purpose
    or not public.purpose_allows_do_not_use(p_purpose);
$$;

drop function if exists public.search_verified_knowledge(text, public.vector, boolean, integer, uuid);

create or replace function public.search_verified_knowledge(
  p_query text,
  p_query_embedding public.vector(1536) default null,
  p_for_drafting boolean default true,
  p_limit integer default 20,
  p_opportunity_id uuid default null,
  p_purpose public.retrieval_purpose default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_version_id uuid,
  source_fact_id uuid,
  storage_bucket text,
  storage_path text,
  source_page integer,
  field text,
  content text,
  reuse_status public.reuse_status,
  rank real,
  match_kind text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q tsquery;
  lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
  drafting boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if p_purpose is not null then
    drafting := public.purpose_requires_drafting_gates(p_purpose);
  else
    drafting := coalesce(p_for_drafting, true);
  end if;

  q := websearch_to_tsquery('english', coalesce(p_query, ''));
  if q is null or q = ''::tsquery then
    q := plainto_tsquery('english', coalesce(p_query, ''));
  end if;

  return query
  select
    c.id,
    c.document_id,
    c.document_version_id,
    c.source_fact_id,
    c.storage_bucket,
    c.storage_path,
    c.source_page,
    c.field,
    c.content,
    c.reuse_status,
    (
      case
        when p_query_embedding is not null and c.embedding is not null then
          (1.0 - (c.embedding <=> p_query_embedding))::real * 0.65
          + coalesce(ts_rank_cd(c.search_vector, q), 0)::real * 0.35
        else coalesce(ts_rank_cd(c.search_vector, q), 0)::real
      end
    )::real as rank,
    (
      case
        when p_query_embedding is not null and c.embedding is not null and c.search_vector @@ q then 'hybrid'
        when p_query_embedding is not null and c.embedding is not null then 'vector'
        else 'fts'
      end
    ) as match_kind
  from public.document_chunks c
  where c.verification_status = 'HUMAN_VERIFIED'
    and public.is_org_member(c.organization_id)
    and (
      not drafting
      or (
        c.reuse_status not in ('DO_NOT_USE', 'SUPERSEDED')
        and c.is_current_version
      )
    )
    and (
      p_opportunity_id is null
      or c.document_id in (
        select d.id
        from public.documents d
        where d.opportunity_id = p_opportunity_id
          and public.is_org_member(d.organization_id)
      )
    )
    and (
      (q is not null and q <> ''::tsquery and c.search_vector @@ q)
      or (p_query_embedding is not null and c.embedding is not null)
    )
  order by rank desc, c.created_at desc
  limit lim;
end;
$$;

revoke all on function public.search_verified_knowledge(text, public.vector, boolean, integer, uuid, public.retrieval_purpose) from public;
grant execute on function public.search_verified_knowledge(text, public.vector, boolean, integer, uuid, public.retrieval_purpose) to authenticated;

-- Bounded automation events (never auto-verify / auto-price / auto-submit).
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  entity_type text,
  entity_id uuid,
  severity text not null default 'info',
  title text not null,
  detail text,
  due_on date,
  source text not null default 'system',
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index if not exists automation_events_idempotent_uidx
  on public.automation_events (organization_id, kind, entity_id, due_on)
  where acknowledged_at is null;

create index if not exists automation_events_org_open_idx
  on public.automation_events (organization_id, created_at desc)
  where acknowledged_at is null;

alter table public.automation_events enable row level security;

drop policy if exists automation_events_select on public.automation_events;
create policy automation_events_select on public.automation_events
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists automation_events_update on public.automation_events;
create policy automation_events_update on public.automation_events
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, update on public.automation_events to authenticated;

comment on table public.automation_events is
  'Bounded automation alerts. Never bypasses human verification, final pricing, proposal approval, or submission authorization.';

create or replace function private.ensure_automation_event(
  p_organization_id uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_severity text,
  p_title text,
  p_detail text,
  p_due_on date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.automation_events e
    where e.organization_id = p_organization_id
      and e.kind = p_kind
      and e.entity_id is not distinct from p_entity_id
      and e.due_on is not distinct from p_due_on
      and e.acknowledged_at is null
  ) then
    update public.automation_events e
      set severity = p_severity,
          title = p_title,
          detail = p_detail,
          created_at = now()
    where e.organization_id = p_organization_id
      and e.kind = p_kind
      and e.entity_id is not distinct from p_entity_id
      and e.due_on is not distinct from p_due_on
      and e.acknowledged_at is null;
    return;
  end if;

  insert into public.automation_events (
    organization_id, kind, entity_type, entity_id, severity, title, detail, due_on, source
  )
  values (
    p_organization_id, p_kind, p_entity_type, p_entity_id, p_severity, p_title, p_detail, p_due_on, 'pg_cron'
  );
end;
$$;

create or replace function private.refresh_pursuit_deadline_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  days integer;
  bucket text;
begin
  for r in
    select o.id, o.organization_id, o.title, o.response_due_on
    from public.opportunities o
    where o.response_due_on is not null
      and o.stage not in ('CLOSED', 'AWARDED')
  loop
    days := (r.response_due_on - current_date);
    if days < 0 then
      bucket := 'EXPIRED';
    elsif days <= 3 then
      bucket := '3';
    elsif days <= 7 then
      bucket := '7';
    elsif days <= 14 then
      bucket := '14';
    else
      continue;
    end if;
    perform private.ensure_automation_event(
      r.organization_id,
      'pursuit_deadline',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Pursuit response due %s (%s)', r.response_due_on, bucket),
      format('Opportunity "%s" response_due_on=%s. Human must authorize submission — automation never submits.', r.title, r.response_due_on),
      r.response_due_on
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function private.refresh_verification_backlog_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
begin
  for r in
    select d.organization_id, count(*)::integer as open_count
    from public.documents d
    where d.processing_status in ('NEEDS_REVIEW', 'FAILED')
    group by d.organization_id
    having count(*) > 0
  loop
    perform private.ensure_automation_event(
      r.organization_id,
      'verification_backlog',
      'organization',
      null,
      case when r.open_count >= 10 then 'high' else 'medium' end,
      format('Verification backlog: %s document(s)', r.open_count),
      'Open NEEDS_REVIEW/FAILED documents require human verification. Automation never auto-verifies facts.',
      current_date
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function private.refresh_compliance_expiration_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  days integer;
begin
  for r in
    select c.id, c.organization_id, c.statement, c.expires_on
    from public.compliance_items c
    where c.expires_on is not null
  loop
    days := (r.expires_on - current_date);
    if days > 60 then
      continue;
    end if;
    perform private.ensure_automation_event(
      r.organization_id,
      'compliance_expiration',
      'compliance_item',
      r.id,
      case when days < 0 then 'critical' when days <= 30 then 'high' else 'medium' end,
      format('Compliance item expires %s', r.expires_on),
      format('%s — human must renew/replace. Automation never fabricates compliance status.', coalesce(r.statement, 'item')),
      r.expires_on
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function private.run_intelligence_automation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_n integer := 0;
  pursuit_n integer := 0;
  verify_n integer := 0;
  compliance_n integer := 0;
begin
  -- Contract renewals already have dedicated cron; call if present.
  begin
    perform private.refresh_contract_alerts();
    contract_n := 1;
  exception when undefined_function then
    contract_n := 0;
  end;
  pursuit_n := private.refresh_pursuit_deadline_alerts();
  verify_n := private.refresh_verification_backlog_alerts();
  begin
    compliance_n := private.refresh_compliance_expiration_alerts();
  exception when undefined_table then
    compliance_n := 0;
  end;
  return jsonb_build_object(
    'ok', true,
    'contract_alerts', contract_n,
    'pursuit_deadlines', pursuit_n,
    'verification_backlog', verify_n,
    'compliance', compliance_n,
    'note', 'No human gates bypassed'
  );
end;
$$;

create or replace function public.run_intelligence_automation()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  return private.run_intelligence_automation();
end;
$$;

revoke all on function public.run_intelligence_automation() from public;
grant execute on function public.run_intelligence_automation() to authenticated;

-- Service-role entry for Vercel Cron (no user session). Still never bypasses human gates.
create or replace function public.run_intelligence_automation_service()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return private.run_intelligence_automation();
end;
$$;

revoke all on function public.run_intelligence_automation_service() from public;
grant execute on function public.run_intelligence_automation_service() to service_role;

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
