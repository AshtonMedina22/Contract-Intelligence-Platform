-- VERIFY 6 fix: internal approval reminders that respect go_no_go + stage.
-- Never auto-approves proposals, pricing, or submission.

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
begin
  -- Clear open reminders when state no longer needs human approval.
  update public.automation_events e
  set acknowledged_at = now(),
      detail = coalesce(e.detail, '') || ' [auto-cleared: approval state resolved or pursuit closed]'
  from public.opportunities o
  where e.organization_id = o.organization_id
    and e.entity_id = o.id
    and e.kind = 'approval_reminder'
    and e.acknowledged_at is null
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
    perform private.ensure_automation_event(
      r.organization_id,
      'approval_reminder',
      'opportunity',
      r.id,
      case when days < 0 then 'critical' when days <= 3 then 'high' else 'medium' end,
      format('Internal approval pending before response due %s', r.response_due_on),
      format(
        'Opportunity "%s" stage=%s go_no_go=PENDING. Human must set GO/NO_GO and authorize proposal — automation never approves pricing, proposals, or submission.',
        r.title,
        r.stage
      ),
      r.response_due_on
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function private.refresh_approval_reminder_alerts() is
  'Bounded approval reminders. Only when go_no_go=PENDING and pre-submit stage. Never auto-approves.';

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
  approval_n integer := 0;
begin
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
  begin
    approval_n := private.refresh_approval_reminder_alerts();
  exception when undefined_function then
    approval_n := 0;
  end;
  return jsonb_build_object(
    'ok', true,
    'contract_alerts', contract_n,
    'pursuit_deadlines', pursuit_n,
    'verification_backlog', verify_n,
    'compliance', compliance_n,
    'approval_reminders', approval_n,
    'note', 'No human gates bypassed'
  );
end;
$$;
