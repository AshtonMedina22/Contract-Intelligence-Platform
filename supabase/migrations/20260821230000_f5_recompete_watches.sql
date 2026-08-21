-- F5: Recompete Radar + Contract Expiration Opportunity Engine
-- Thin watch table for Market radar candidates (not L&P renewals).
-- Hardens alert refresh when contracts.verified_end_on changes via any path.

-- ---------------------------------------------------------------------------
-- recompete_watches (Market radar operator lifecycle)
-- ---------------------------------------------------------------------------

create table if not exists public.recompete_watches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  candidate_key text not null,
  status text not null default 'WATCHING',
  buyer_id uuid,
  award_id uuid,
  contract_id uuid,
  opportunity_id uuid,
  source_url text,
  title text,
  notes text,
  pursuit_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, candidate_key),
  constraint recompete_watches_status_check check (
    status in (
      'WATCHING',
      'READY_FOR_CAPTURE',
      'PURSUIT_STARTED',
      'DISMISSED',
      'STALE'
    )
  ),
  constraint recompete_watches_candidate_key_present check (length(btrim(candidate_key)) > 0),
  constraint recompete_watches_buyer_same_org_fkey
    foreign key (buyer_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint recompete_watches_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null,
  constraint recompete_watches_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint recompete_watches_pursuit_same_org_fkey
    foreign key (pursuit_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null
);

comment on table public.recompete_watches is
  'Market Recompete Radar operator watches. Distinct from L&P contract_alerts renewals. Automation never auto-creates pursuits from these rows.';
comment on column public.recompete_watches.candidate_key is
  'Stable radar row key (e.g. contract:<uuid> or opportunity:<uuid>). Unique per org so Watch upserts, never daily-duplicates.';
comment on column public.recompete_watches.status is
  'WATCHING | READY_FOR_CAPTURE | PURSUIT_STARTED | DISMISSED | STALE. Operator-driven; cron does not invent pursuits.';

create index if not exists recompete_watches_org_status_idx
  on public.recompete_watches (organization_id, status);

create index if not exists recompete_watches_org_updated_idx
  on public.recompete_watches (organization_id, updated_at desc);

alter table public.recompete_watches enable row level security;

drop policy if exists recompete_watches_select on public.recompete_watches;
create policy recompete_watches_select on public.recompete_watches
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists recompete_watches_insert on public.recompete_watches;
create policy recompete_watches_insert on public.recompete_watches
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists recompete_watches_update on public.recompete_watches;
create policy recompete_watches_update on public.recompete_watches
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists recompete_watches_delete on public.recompete_watches;
create policy recompete_watches_delete on public.recompete_watches
  for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.recompete_watches to authenticated;

-- ---------------------------------------------------------------------------
-- On any verified_end_on change: refresh contract_alerts (promote already calls
-- refresh; this catches amendments / future writers that update the end date).
-- ---------------------------------------------------------------------------

create or replace function private.contracts_verified_end_refresh_alerts()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE'
     and new.verified_end_on is not distinct from old.verified_end_on then
    return new;
  end if;
  perform private.refresh_contract_alerts();
  return new;
end;
$$;

drop trigger if exists contracts_verified_end_refresh_alerts on public.contracts;
create trigger contracts_verified_end_refresh_alerts
  after insert or update of verified_end_on on public.contracts
  for each row
  execute function private.contracts_verified_end_refresh_alerts();

comment on function private.contracts_verified_end_refresh_alerts() is
  'F5: when contracts.verified_end_on is set or changed, recompute contract_alerts upserts. Does not create pursuits.';

revoke all on function private.contracts_verified_end_refresh_alerts() from public;
revoke all on function private.contracts_verified_end_refresh_alerts() from anon;
revoke all on function private.contracts_verified_end_refresh_alerts() from authenticated;
