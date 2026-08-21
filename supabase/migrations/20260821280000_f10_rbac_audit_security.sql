-- F10 — RBAC audit log + production security scaffolding
-- Append-only org-scoped audit trail for consequential operator actions.
-- Application RBAC continues to live in apps/web/lib/auth/permissions.ts
-- (memberships.role: admin | importer | verifier | bidder | executive).

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx
  on public.audit_log (organization_id, created_at desc);

create index if not exists audit_log_org_action_idx
  on public.audit_log (organization_id, action, created_at desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (organization_id, entity_type, entity_id);

comment on table public.audit_log is
  'F10 append-only audit of consequential RBAC-gated mutations. Never store secrets in metadata.';

alter table public.audit_log enable row level security;

-- Org members may read their org's audit trail
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select
  using (public.is_org_member(organization_id));

-- Authenticated members may insert rows only for orgs they belong to
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert
  with check (
    public.is_org_member(organization_id)
    and actor_user_id = auth.uid()
  );

-- No update/delete for authenticated clients (append-only)
drop policy if exists audit_log_update on public.audit_log;
drop policy if exists audit_log_delete on public.audit_log;

-- Optional security-definer helper for service-role / cron writers
create or replace function public.write_audit_log(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_organization_id is null or p_actor_user_id is null then
    raise exception 'organization_id and actor_user_id required';
  end if;
  if coalesce(trim(p_action), '') = '' or coalesce(trim(p_entity_type), '') = '' then
    raise exception 'action and entity_type required';
  end if;

  insert into public.audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    p_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, uuid, text, text, text, jsonb) from public;
grant execute on function public.write_audit_log(uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

comment on function public.write_audit_log is
  'F10 security-definer audit insert. Prefer app writeAuditLog via RLS insert when acting as the member.';
