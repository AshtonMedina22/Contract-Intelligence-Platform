-- F9 — Operational Automation + Notification Delivery Engine
-- EXTENDS private.run_intelligence_automation + pg_cron intelligence-automation-daily.
-- NEVER verifies evidence, selects final price, approves proposals, submits bids,
-- renews contracts, or exercises options. Notify / remind / queue only.

-- ---------------------------------------------------------------------------
-- Opportunity deadline columns (nullable — only fire when populated)
-- ---------------------------------------------------------------------------
alter table public.opportunities
  add column if not exists questions_due_on date,
  add column if not exists conference_due_on date,
  add column if not exists prebid_due_on date;

comment on column public.opportunities.questions_due_on is
  'Questions / clarifications deadline when known. Automation reminds only.';
comment on column public.opportunities.conference_due_on is
  'Mandatory conference / site visit date when known. Automation reminds only.';
comment on column public.opportunities.prebid_due_on is
  'Pre-bid meeting deadline when known. Automation reminds only.';

-- Org flag for optional research-refresh reminders (never auto-verify)
alter table public.organizations
  add column if not exists automation_research_refresh_enabled boolean not null default false;

comment on column public.organizations.automation_research_refresh_enabled is
  'When true, automation may emit research_refresh reminders for stale REVIEW_READY runs. Never auto-verifies.';

-- ---------------------------------------------------------------------------
-- Extend automation_events (Phase 6 columns preserved)
-- acknowledged_at remains the Phase 6 "open" gate; resolved_at mirrors it.
-- ---------------------------------------------------------------------------
alter table public.automation_events
  add column if not exists dedupe_key text,
  add column if not exists deep_link text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists first_triggered_at timestamptz,
  add column if not exists last_triggered_at timestamptz,
  add column if not exists resolved_at timestamptz;

-- Backfill dedupe + timestamps; mirror acknowledged → resolved
update public.automation_events e
set
  first_triggered_at = coalesce(e.first_triggered_at, e.created_at),
  last_triggered_at = coalesce(e.last_triggered_at, e.created_at),
  resolved_at = coalesce(e.resolved_at, e.acknowledged_at),
  dedupe_key = coalesce(
    e.dedupe_key,
    e.kind || ':' || coalesce(e.entity_id::text, 'org') || ':' || coalesce(e.due_on::text, 'na')
  )
where e.dedupe_key is null
   or e.first_triggered_at is null
   or e.last_triggered_at is null;

alter table public.automation_events
  alter column first_triggered_at set default now(),
  alter column last_triggered_at set default now();

-- Replace Phase 6 open unique index with dedupe_key uniqueness among open events
drop index if exists public.automation_events_idempotent_uidx;

create unique index if not exists automation_events_open_dedupe_uidx
  on public.automation_events (organization_id, dedupe_key)
  where acknowledged_at is null and resolved_at is null;

create index if not exists automation_events_org_open_resolved_idx
  on public.automation_events (organization_id, created_at desc)
  where acknowledged_at is null and resolved_at is null;

comment on column public.automation_events.dedupe_key is
  'Stable upsert key per org among open events. Deadline changes update the same row.';
comment on column public.automation_events.deep_link is
  'In-app path for the Action Center / notification deep link.';
comment on column public.automation_events.resolved_at is
  'When the underlying condition cleared or a human resolved. Mirrors acknowledged_at for Phase 6.';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  automation_event_id uuid,
  channel text not null default 'in_app'
    check (channel in ('in_app', 'email', 'digest')),
  title text not null,
  body text,
  deep_link text,
  severity text not null default 'info',
  status text not null default 'open'
    check (status in ('open', 'read', 'resolved')),
  read_at timestamptz,
  resolved_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint notifications_event_fkey
    foreign key (automation_event_id)
    references public.automation_events (id)
    on delete set null
);

create unique index if not exists notifications_open_dedupe_uidx
  on public.notifications (
    organization_id,
    (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    channel,
    dedupe_key
  )
  where status = 'open' and dedupe_key is not null;

create index if not exists notifications_org_open_idx
  on public.notifications (organization_id, created_at desc)
  where status = 'open';

create index if not exists notifications_user_open_idx
  on public.notifications (user_id, created_at desc)
  where status = 'open' and user_id is not null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    public.is_org_member(organization_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

grant select, update on public.notifications to authenticated;

comment on table public.notifications is
  'In-app / digest / email notification rows. Automation never auto-approves or auto-submits.';

-- ---------------------------------------------------------------------------
-- ensure_automation_event — upsert by dedupe_key; bump last_triggered_at
-- ---------------------------------------------------------------------------
drop function if exists private.ensure_automation_event(uuid, text, text, uuid, text, text, text, date);
drop function if exists private.ensure_automation_event(uuid, text, text, uuid, text, text, text, date, text, text, uuid);

create or replace function private.ensure_automation_event(
  p_organization_id uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_severity text,
  p_title text,
  p_detail text,
  p_due_on date,
  p_dedupe_key text default null,
  p_deep_link text default null,
  p_owner_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_id uuid;
begin
  v_key := coalesce(
    nullif(btrim(p_dedupe_key), ''),
    p_kind || ':' || coalesce(p_entity_id::text, 'org') || ':' || coalesce(p_due_on::text, 'na')
  );

  select e.id into v_id
  from public.automation_events e
  where e.organization_id = p_organization_id
    and e.dedupe_key = v_key
    and e.acknowledged_at is null
    and e.resolved_at is null
  limit 1;

  if v_id is not null then
    update public.automation_events e
    set severity = p_severity,
        title = p_title,
        detail = p_detail,
        due_on = p_due_on,
        entity_type = coalesce(p_entity_type, e.entity_type),
        entity_id = coalesce(p_entity_id, e.entity_id),
        deep_link = coalesce(p_deep_link, e.deep_link),
        owner_user_id = coalesce(p_owner_user_id, e.owner_user_id),
        last_triggered_at = now(),
        kind = p_kind
    where e.id = v_id;
    return v_id;
  end if;

  insert into public.automation_events (
    organization_id, kind, entity_type, entity_id, severity, title, detail, due_on,
    source, dedupe_key, deep_link, owner_user_id, first_triggered_at, last_triggered_at
  )
  values (
    p_organization_id, p_kind, p_entity_type, p_entity_id, p_severity, p_title, p_detail, p_due_on,
    'pg_cron', v_key, p_deep_link, p_owner_user_id, now(), now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.ensure_automation_event(uuid, text, text, uuid, text, text, text, date, text, text, uuid)
  from public, anon, authenticated;

-- Resolve open events of a kind whose dedupe_key is not in the active set
create or replace function private.resolve_stale_automation_events(
  p_kind text,
  p_active_keys text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.automation_events e
  set acknowledged_at = coalesce(e.acknowledged_at, now()),
      resolved_at = coalesce(e.resolved_at, now()),
      detail = coalesce(e.detail, '') || ' [auto-cleared: condition resolved]'
  where e.kind = p_kind
    and e.acknowledged_at is null
    and e.resolved_at is null
    and (
      p_active_keys is null
      or cardinality(p_active_keys) = 0
      or e.dedupe_key <> all (p_active_keys)
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.resolve_stale_automation_events(text, text[])
  from public, anon, authenticated;

-- Mirror open automation event → in_app org notification (deduped)
create or replace function private.mirror_in_app_notification(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.automation_events%rowtype;
begin
  select * into e from public.automation_events where id = p_event_id;
  if not found then
    return;
  end if;
  if e.acknowledged_at is not null or e.resolved_at is not null then
    return;
  end if;

  update public.notifications n
  set title = e.title,
      body = e.detail,
      deep_link = e.deep_link,
      severity = e.severity,
      automation_event_id = e.id
  where n.organization_id = e.organization_id
    and n.channel = 'in_app'
    and n.status = 'open'
    and n.dedupe_key = e.dedupe_key
    and n.user_id is not distinct from e.owner_user_id;

  if not found then
    insert into public.notifications (
      organization_id, user_id, automation_event_id, channel, title, body,
      deep_link, severity, status, dedupe_key
    )
    values (
      e.organization_id, e.owner_user_id, e.id, 'in_app', e.title, e.detail,
      e.deep_link, e.severity, 'open', e.dedupe_key
    );
  end if;
end;
$$;

revoke all on function private.mirror_in_app_notification(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) pursuit_deadline (harden) + 9) submission_deadline companion
-- ---------------------------------------------------------------------------
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
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
  sub_keys text[] := array[]::text[];
begin
  for r in
    select o.id, o.organization_id, o.title, o.response_due_on
    from public.opportunities o
    where o.response_due_on is not null
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
  loop
    days := (r.response_due_on - current_date);
    if days > 30 then
      continue;
    end if;
    if days < 0 then
      bucket := 'overdue';
    elsif days = 0 then
      bucket := 'today';
    elsif days <= 7 then
      bucket := '7';
    elsif days <= 14 then
      bucket := '14';
    else
      bucket := '30';
    end if;

    v_key := 'pursuit_deadline:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'pursuit_deadline',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Pursuit response due %s (%s)', r.response_due_on, bucket),
      format('Opportunity "%s" response_due_on=%s. Human must authorize submission — automation never submits.', r.title, r.response_due_on),
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.id::text,
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;

    -- Companion kind (same due) — clear product distinction for digest grouping
    v_key := 'submission_deadline:' || r.id::text;
    sub_keys := array_append(sub_keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'submission_deadline',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Submission deadline %s (%s)', r.response_due_on, bucket),
      format('Companion to pursuit deadline for "%s". Automation never submits bids.', r.title),
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.id::text || '/submission',
      null
    );
    perform private.mirror_in_app_notification(v_id);
  end loop;

  perform private.resolve_stale_automation_events('pursuit_deadline', keys);
  perform private.resolve_stale_automation_events('submission_deadline', sub_keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) questions_deadline
-- ---------------------------------------------------------------------------
create or replace function private.refresh_questions_deadline_alerts()
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
begin
  for r in
    select o.id, o.organization_id, o.title, o.questions_due_on
    from public.opportunities o
    where o.questions_due_on is not null
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
  loop
    days := (r.questions_due_on - current_date);
    if days > 30 then
      continue;
    end if;
    v_key := 'questions_deadline:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'questions_deadline',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Questions deadline %s', r.questions_due_on),
      format('Opportunity "%s" questions_due_on=%s. Reminder only.', r.title, r.questions_due_on),
      r.questions_due_on,
      v_key,
      '/procurement/opportunities/' || r.id::text,
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('questions_deadline', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) mandatory_conference / prebid_deadline
-- ---------------------------------------------------------------------------
create or replace function private.refresh_conference_prebid_alerts()
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
  conf_keys text[] := array[]::text[];
  prebid_keys text[] := array[]::text[];
begin
  for r in
    select o.id, o.organization_id, o.title, o.conference_due_on, o.prebid_due_on
    from public.opportunities o
    where o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
      and (o.conference_due_on is not null or o.prebid_due_on is not null)
  loop
    if r.conference_due_on is not null then
      days := (r.conference_due_on - current_date);
      if days <= 30 then
        v_key := 'mandatory_conference:' || r.id::text;
        conf_keys := array_append(conf_keys, v_key);
        v_id := private.ensure_automation_event(
          r.organization_id,
          'mandatory_conference',
          'opportunity',
          r.id,
          case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
          format('Mandatory conference %s', r.conference_due_on),
          format('Opportunity "%s" conference_due_on=%s. Reminder only — no auto RSVP.', r.title, r.conference_due_on),
          r.conference_due_on,
          v_key,
          '/procurement/opportunities/' || r.id::text,
          null
        );
        perform private.mirror_in_app_notification(v_id);
        n := n + 1;
      end if;
    end if;

    if r.prebid_due_on is not null then
      days := (r.prebid_due_on - current_date);
      if days <= 30 then
        v_key := 'prebid_deadline:' || r.id::text;
        prebid_keys := array_append(prebid_keys, v_key);
        v_id := private.ensure_automation_event(
          r.organization_id,
          'prebid_deadline',
          'opportunity',
          r.id,
          case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
          format('Pre-bid deadline %s', r.prebid_due_on),
          format('Opportunity "%s" prebid_due_on=%s. Reminder only.', r.title, r.prebid_due_on),
          r.prebid_due_on,
          v_key,
          '/procurement/opportunities/' || r.id::text,
          null
        );
        perform private.mirror_in_app_notification(v_id);
        n := n + 1;
      end if;
    end if;
  end loop;
  perform private.resolve_stale_automation_events('mandatory_conference', conf_keys);
  perform private.resolve_stale_automation_events('prebid_deadline', prebid_keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) pricing_approval_pending
-- ---------------------------------------------------------------------------
create or replace function private.refresh_pricing_approval_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select pd.id, pd.organization_id, pd.opportunity_id, o.title, o.response_due_on
    from public.pricing_decisions pd
    join public.opportunities o
      on o.id = pd.opportunity_id and o.organization_id = pd.organization_id
    where pd.status = 'DRAFT'
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
  loop
    v_key := 'pricing_approval_pending:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'pricing_approval_pending',
      'pricing_decision',
      r.id,
      'high',
      format('Pricing decision pending approval — %s', coalesce(r.title, 'pursuit')),
      'DRAFT pricing_decisions require a human HUMAN_APPROVED decision. Automation never selects final price.',
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.opportunity_id::text || '/pricing',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('pricing_approval_pending', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) response_approval_pending (harden approval_reminder → product kind)
-- Keep clearing legacy approval_reminder rows.
-- ---------------------------------------------------------------------------
create or replace function private.refresh_approval_reminder_alerts()
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
begin
  -- Clear legacy kind
  update public.automation_events e
  set acknowledged_at = coalesce(e.acknowledged_at, now()),
      resolved_at = coalesce(e.resolved_at, now()),
      detail = coalesce(e.detail, '') || ' [migrated/cleared: use response_approval_pending]'
  where e.kind = 'approval_reminder'
    and e.acknowledged_at is null
    and e.resolved_at is null;

  update public.automation_events e
  set acknowledged_at = coalesce(e.acknowledged_at, now()),
      resolved_at = coalesce(e.resolved_at, now()),
      detail = coalesce(e.detail, '') || ' [auto-cleared: approval state resolved or pursuit closed]'
  from public.opportunities o
  where e.organization_id = o.organization_id
    and e.entity_id = o.id
    and e.kind = 'response_approval_pending'
    and e.acknowledged_at is null
    and e.resolved_at is null
    and (
      o.go_no_go is distinct from 'PENDING'
      or o.stage in ('SUBMITTED', 'AWARDED', 'CLOSED')
      or o.response_due_on is null
    );

  for r in
    select o.id, o.organization_id, o.title, o.response_due_on, o.stage, o.go_no_go
    from public.opportunities o
    where o.response_due_on is not null
      and o.go_no_go = 'PENDING'
      and o.stage in ('INTAKE', 'ANALYSIS', 'PRICING', 'DRAFTING')
  loop
    days := (r.response_due_on - current_date);
    if days > 14 then
      continue;
    end if;
    v_key := 'response_approval_pending:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'response_approval_pending',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Internal approval pending before response due %s', r.response_due_on),
      format(
        'Opportunity "%s" stage=%s go_no_go=PENDING. Human must set GO/NO_GO and authorize proposal — automation never approves pricing, proposals, or submission.',
        r.title,
        r.stage
      ),
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.id::text,
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;

  -- Also fire when enabled approval layers are requested
  for r in
    select distinct on (pal.opportunity_id)
      pal.organization_id, pal.opportunity_id as id, o.title, o.response_due_on, o.stage
    from public.pursuit_approval_layers pal
    join public.opportunities o
      on o.id = pal.opportunity_id and o.organization_id = pal.organization_id
    where pal.enabled = true
      and pal.status = 'requested'
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
  loop
    v_key := 'response_approval_pending:' || r.id::text;
    if not (v_key = any (keys)) then
      keys := array_append(keys, v_key);
      v_id := private.ensure_automation_event(
        r.organization_id,
        'response_approval_pending',
        'opportunity',
        r.id,
        'high',
        format('Approval layer requested — %s', coalesce(r.title, 'pursuit')),
        'Enabled pursuit_approval_layers with status=requested. Automation never approves.',
        r.response_due_on,
        v_key,
        '/procurement/opportunities/' || r.id::text,
        null
      );
      perform private.mirror_in_app_notification(v_id);
      n := n + 1;
    end if;
  end loop;

  perform private.resolve_stale_automation_events('response_approval_pending', keys);
  return n;
end;
$$;

comment on function private.refresh_approval_reminder_alerts() is
  'Bounded response_approval_pending reminders. Never auto-approves.';

-- ---------------------------------------------------------------------------
-- 6) lp_input_required_outstanding
-- ---------------------------------------------------------------------------
create or replace function private.refresh_lp_input_required_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select
      o.id as opportunity_id,
      o.organization_id,
      o.title,
      o.response_due_on,
      count(*)::integer as open_count
    from public.requirement_responses rr
    join public.opportunities o
      on o.id = rr.opportunity_id and o.organization_id = rr.organization_id
    where rr.evidence_state = 'L_AND_P_INPUT_REQUIRED'
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
    group by o.id, o.organization_id, o.title, o.response_due_on
    having count(*) > 0
  loop
    v_key := 'lp_input_required_outstanding:' || r.opportunity_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'lp_input_required_outstanding',
      'opportunity',
      r.opportunity_id,
      'high',
      format('L&P input required — %s item(s) on %s', r.open_count, coalesce(r.title, 'pursuit')),
      'requirement_responses with evidence_state=L_AND_P_INPUT_REQUIRED. Humans must supply facts — automation never invents L&P content.',
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.opportunity_id::text || '/response',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;

  -- Also matrix_status on requirements
  for r in
    select
      s.opportunity_id,
      req.organization_id,
      o.title,
      o.response_due_on,
      count(*)::integer as open_count
    from public.requirements req
    join public.solicitations s
      on s.id = req.solicitation_id and s.organization_id = req.organization_id
    join public.opportunities o
      on o.id = s.opportunity_id and o.organization_id = s.organization_id
    where req.matrix_status = 'L_AND_P_INPUT_REQUIRED'
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
    group by s.opportunity_id, req.organization_id, o.title, o.response_due_on
    having count(*) > 0
  loop
    v_key := 'lp_input_required_outstanding:' || r.opportunity_id::text;
    if not (v_key = any (keys)) then
      keys := array_append(keys, v_key);
      v_id := private.ensure_automation_event(
        r.organization_id,
        'lp_input_required_outstanding',
        'opportunity',
        r.opportunity_id,
        'high',
        format('L&P input required — %s requirement(s) on %s', r.open_count, coalesce(r.title, 'pursuit')),
        'requirements.matrix_status=L_AND_P_INPUT_REQUIRED. Automation never invents L&P facts.',
        r.response_due_on,
        v_key,
        '/procurement/opportunities/' || r.opportunity_id::text || '/response',
        null
      );
      perform private.mirror_in_app_notification(v_id);
      n := n + 1;
    end if;
  end loop;

  perform private.resolve_stale_automation_events('lp_input_required_outstanding', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) mandatory_requirement_outstanding
-- ---------------------------------------------------------------------------
create or replace function private.refresh_mandatory_requirement_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select
      s.opportunity_id,
      req.organization_id,
      o.title,
      o.response_due_on,
      count(*)::integer as open_count
    from public.requirements req
    join public.solicitations s
      on s.id = req.solicitation_id and s.organization_id = req.organization_id
    join public.opportunities o
      on o.id = s.opportunity_id and o.organization_id = s.organization_id
    where req.response_required = true
      and req.scored = false
      and req.matrix_status not in ('APPROVED')
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
    group by s.opportunity_id, req.organization_id, o.title, o.response_due_on
    having count(*) > 0
  loop
    v_key := 'mandatory_requirement_outstanding:' || r.opportunity_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'mandatory_requirement_outstanding',
      'opportunity',
      r.opportunity_id,
      'high',
      format('Mandatory requirements incomplete — %s on %s', r.open_count, coalesce(r.title, 'pursuit')),
      'Pass/fail mandatory requirements not yet APPROVED. Automation never marks requirements complete.',
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.opportunity_id::text || '/response',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('mandatory_requirement_outstanding', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) submission_checklist_incomplete
-- ---------------------------------------------------------------------------
create or replace function private.refresh_submission_checklist_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select
      sci.opportunity_id,
      sci.organization_id,
      o.title,
      o.response_due_on,
      count(*)::integer as open_count
    from public.submission_checklist_items sci
    join public.opportunities o
      on o.id = sci.opportunity_id and o.organization_id = sci.organization_id
    where sci.required = true
      and sci.completed = false
      and o.stage not in ('CLOSED', 'AWARDED', 'SUBMITTED')
    group by sci.opportunity_id, sci.organization_id, o.title, o.response_due_on
    having count(*) > 0
  loop
    v_key := 'submission_checklist_incomplete:' || r.opportunity_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'submission_checklist_incomplete',
      'opportunity',
      r.opportunity_id,
      'medium',
      format('Submission checklist incomplete — %s item(s) on %s', r.open_count, coalesce(r.title, 'pursuit')),
      'Required submission_checklist_items still open. Automation never marks ready or submits.',
      r.response_due_on,
      v_key,
      '/procurement/opportunities/' || r.opportunity_id::text || '/submission',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('submission_checklist_incomplete', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) verification_backlog (NEEDS_REVIEW only) + 11) processing_failure (FAILED)
-- ---------------------------------------------------------------------------
create or replace function private.refresh_verification_backlog_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select d.organization_id, count(*)::integer as open_count
    from public.documents d
    where d.processing_status = 'NEEDS_REVIEW'
    group by d.organization_id
    having count(*) > 0
  loop
    v_key := 'verification_backlog:' || r.organization_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'verification_backlog',
      'organization',
      null,
      case when r.open_count >= 10 then 'high' else 'medium' end,
      format('Verification backlog: %s document(s)', r.open_count),
      'Open NEEDS_REVIEW documents require human verification. Automation never auto-verifies facts.',
      current_date,
      v_key,
      '/ingestion/verification',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('verification_backlog', keys);
  return n;
end;
$$;

create or replace function private.refresh_processing_failure_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select d.organization_id, count(*)::integer as open_count
    from public.documents d
    where d.processing_status = 'FAILED'
       or d.lifecycle_error is not null
    group by d.organization_id
    having count(*) > 0
  loop
    v_key := 'processing_failure:' || r.organization_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'processing_failure',
      'organization',
      null,
      'high',
      format('Processing failures: %s document(s)', r.open_count),
      'FAILED / lifecycle_error documents need human retry. Re-runs must not duplicate this open event (dedupe_key stable).',
      current_date,
      v_key,
      '/ingestion/processing',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('processing_failure', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12) compliance_expiration (harden)
-- ---------------------------------------------------------------------------
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
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
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
    v_key := 'compliance_expiration:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'compliance_expiration',
      'compliance_item',
      r.id,
      case when days < 0 then 'critical' when days <= 30 then 'high' else 'medium' end,
      format('Compliance item expires %s', r.expires_on),
      format('%s — human must renew/replace. Automation never fabricates compliance status.', coalesce(r.statement, 'item')),
      r.expires_on,
      v_key,
      '/contracts/compliance',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('compliance_expiration', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13) contract_review_window — bridge from contract_alerts
-- ---------------------------------------------------------------------------
create or replace function private.refresh_contract_review_window_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select ca.organization_id, ca.contract_id, ca.bucket::text as bucket, ca.verified_end_on, ca.days_until,
           c.title
    from public.contract_alerts ca
    join public.contracts c
      on c.id = ca.contract_id and c.organization_id = ca.organization_id
    where ca.bucket::text in ('90', '60', '30', 'EXPIRED')
  loop
    v_key := 'contract_review_window:' || r.contract_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'contract_review_window',
      'contract',
      r.contract_id,
      case when r.bucket = 'EXPIRED' then 'critical' when r.bucket in ('30', '60') then 'high' else 'medium' end,
      format('Contract review window %s — %s', r.bucket, coalesce(r.title, 'contract')),
      format('contract_alerts bucket=%s verified_end_on=%s days_until=%s. Advisory only — automation never renews.', r.bucket, r.verified_end_on, r.days_until),
      r.verified_end_on,
      v_key,
      '/contracts/' || r.contract_id::text || '/renewal',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('contract_review_window', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14) renewal_notice — notify only, NEVER auto renew
-- ---------------------------------------------------------------------------
create or replace function private.refresh_renewal_notice_alerts()
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
begin
  for r in
    select rn.id, rn.organization_id, rn.contract_id, rn.notice_due_on, rn.notice, c.title
    from public.renewals rn
    join public.contracts c
      on c.id = rn.contract_id and c.organization_id = rn.organization_id
    where rn.notice_due_on is not null
  loop
    days := (r.notice_due_on - current_date);
    if days > 90 then
      continue;
    end if;
    v_key := 'renewal_notice:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'renewal_notice',
      'renewal',
      r.id,
      case when days < 0 then 'critical' when days <= 30 then 'high' else 'medium' end,
      format('Renewal notice due %s — %s', r.notice_due_on, coalesce(r.title, 'contract')),
      format('%s — CatalogIT-style reminder only. Automation NEVER renews contracts.', coalesce(r.notice, 'Renewal notice')),
      r.notice_due_on,
      v_key,
      '/contracts/' || r.contract_id::text || '/renewal',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('renewal_notice', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15) rebid_planning — 180 / 120 advisory buckets
-- ---------------------------------------------------------------------------
create or replace function private.refresh_rebid_planning_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select ca.organization_id, ca.contract_id, ca.bucket::text as bucket, ca.verified_end_on, c.title
    from public.contract_alerts ca
    join public.contracts c
      on c.id = ca.contract_id and c.organization_id = ca.organization_id
    where ca.bucket::text in ('180', '120')
  loop
    v_key := 'rebid_planning:' || r.contract_id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'rebid_planning',
      'contract',
      r.contract_id,
      'medium',
      format('Rebid planning window %s — %s', r.bucket, coalesce(r.title, 'contract')),
      format('Advisory recompete/renewal planning from contract_alerts bucket=%s. Automation never starts a bid or copies pricing.', r.bucket),
      r.verified_end_on,
      v_key,
      '/contracts/' || r.contract_id::text || '/renewal',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('rebid_planning', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16) option_decision — only when exercise_by dated
-- ---------------------------------------------------------------------------
create or replace function private.refresh_option_decision_alerts()
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
begin
  for r in
    select co.id, co.organization_id, co.contract_id, co.label, co.exercise_by, c.title
    from public.contract_options co
    join public.contracts c
      on c.id = co.contract_id and c.organization_id = co.organization_id
    where co.exercise_by is not null
  loop
    days := (r.exercise_by - current_date);
    if days > 120 then
      continue;
    end if;
    v_key := 'option_decision:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'option_decision',
      'contract_option',
      r.id,
      case when days < 0 then 'critical' when days <= 30 then 'high' else 'medium' end,
      format('Option decision by %s — %s', r.exercise_by, coalesce(r.label, 'option')),
      format('Contract "%s" option exercise_by=%s. Automation NEVER exercises options — human decision required.', coalesce(r.title, 'contract'), r.exercise_by),
      r.exercise_by,
      v_key,
      '/contracts/' || r.contract_id::text || '/renewal',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('option_decision', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 17) research_refresh — flag OR stale REVIEW_READY; never auto-verify
-- ---------------------------------------------------------------------------
create or replace function private.refresh_research_refresh_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  v_key text;
  v_id uuid;
  keys text[] := array[]::text[];
begin
  for r in
    select rr.id, rr.organization_id, rr.query, rr.created_at, org.automation_research_refresh_enabled
    from public.research_runs rr
    join public.organizations org on org.id = rr.organization_id
    where rr.status = 'REVIEW_READY'
      and (
        org.automation_research_refresh_enabled = true
        or rr.created_at < now() - interval '14 days'
      )
  loop
    v_key := 'research_refresh:' || r.id::text;
    keys := array_append(keys, v_key);
    v_id := private.ensure_automation_event(
      r.organization_id,
      'research_refresh',
      'research_run',
      r.id,
      'low',
      format('Research review outstanding — %s', left(coalesce(r.query, 'run'), 80)),
      'Stale or flagged research_run in REVIEW_READY. Automation never auto-verifies research facts.',
      current_date,
      v_key,
      '/intelligence/research',
      null
    );
    perform private.mirror_in_app_notification(v_id);
    n := n + 1;
  end loop;
  perform private.resolve_stale_automation_events('research_refresh', keys);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orchestrator — SAME function + SAME cron job name (no second scheduler)
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
    'note', 'No human gates bypassed — never verify/price/approve/submit/renew/exercise'
  );
end;
$$;

revoke all on function private.run_intelligence_automation() from public, anon, authenticated;

-- Defense-in-depth: revoke new private helpers
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'refresh_questions_deadline_alerts()',
    'refresh_conference_prebid_alerts()',
    'refresh_pricing_approval_alerts()',
    'refresh_lp_input_required_alerts()',
    'refresh_mandatory_requirement_alerts()',
    'refresh_submission_checklist_alerts()',
    'refresh_processing_failure_alerts()',
    'refresh_contract_review_window_alerts()',
    'refresh_renewal_notice_alerts()',
    'refresh_rebid_planning_alerts()',
    'refresh_option_decision_alerts()',
    'refresh_research_refresh_alerts()',
    'refresh_approval_reminder_alerts()',
    'refresh_pursuit_deadline_alerts()',
    'refresh_verification_backlog_alerts()',
    'refresh_compliance_expiration_alerts()'
  ]
  loop
    begin
      execute format('revoke all on function private.%s from public, anon, authenticated', fn);
    exception when others then
      null;
    end;
  end loop;
end $$;

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
