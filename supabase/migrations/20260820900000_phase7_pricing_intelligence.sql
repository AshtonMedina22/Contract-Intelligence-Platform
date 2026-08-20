-- Canonical Phase 7 — Pricing Intelligence
-- Pursuit workbench + human final bid. AI never sets HUMAN_APPROVED.

-- Fifth commercial truth: L&P internal cost (planning / cost model — not promoted award truth).
alter table public.pricing_lines
  add column if not exists internal_cost_rate numeric;

comment on column public.pricing_lines.internal_cost_rate is
  'L&P internal cost rate (planning). Distinct from buyer requested / L&P submitted / awarded / current.';

-- Cost model extras for wage/H&W/vehicles/travel/WD.
alter table public.pricing_cost_models
  add column if not exists health_welfare numeric,
  add column if not exists vehicles numeric,
  add column if not exists travel numeric,
  add column if not exists wage_determination_ref text,
  add column if not exists cost_floor numeric;

comment on column public.pricing_cost_models.cost_floor is
  'Loaded cost floor for this labor category — bid should not go below without human override note.';

-- Human final bid decisions (required — never AI-approved).
create table if not exists public.pricing_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  labor_category text,
  pricing_line_id uuid,
  final_bid_rate numeric,
  final_bid_amount numeric,
  cost_floor numeric,
  target_margin_pct numeric,
  observed_min numeric,
  observed_max numeric,
  observed_median numeric,
  observed_n integer not null default 0,
  confidence text,
  data_sufficiency text,
  include_summary text,
  exclude_summary text,
  rationale text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'HUMAN_APPROVED')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade
);

create index if not exists pricing_decisions_opp_idx
  on public.pricing_decisions (organization_id, opportunity_id);

alter table public.pricing_decisions enable row level security;

drop policy if exists pricing_decisions_select on public.pricing_decisions;
create policy pricing_decisions_select on public.pricing_decisions
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists pricing_decisions_insert on public.pricing_decisions;
create policy pricing_decisions_insert on public.pricing_decisions
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists pricing_decisions_update on public.pricing_decisions;
create policy pricing_decisions_update on public.pricing_decisions
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update on public.pricing_decisions to authenticated;

comment on table public.pricing_decisions is
  'Human final bid decisions. status=HUMAN_APPROVED requires decided_by. Automation/AI never approves.';

-- Include/exclude judgments for comparable pricing lines.
create table if not exists public.pricing_comparable_judgments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  source_pricing_line_id uuid not null,
  included boolean not null default true,
  reason text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, opportunity_id, source_pricing_line_id),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade
);

create index if not exists pricing_comparable_judgments_opp_idx
  on public.pricing_comparable_judgments (organization_id, opportunity_id);

alter table public.pricing_comparable_judgments enable row level security;

drop policy if exists pricing_comparable_judgments_select on public.pricing_comparable_judgments;
create policy pricing_comparable_judgments_select on public.pricing_comparable_judgments
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists pricing_comparable_judgments_write on public.pricing_comparable_judgments;
create policy pricing_comparable_judgments_write on public.pricing_comparable_judgments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.pricing_comparable_judgments to authenticated;

comment on table public.pricing_comparable_judgments is
  'Human include/exclude of comparable pricing_lines with required reason. Decision support only.';

-- Guard: HUMAN_APPROVED requires actor + timestamp + a numeric bid.
create or replace function public.pricing_decisions_require_human()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'HUMAN_APPROVED' then
    if new.decided_by is null then
      raise exception 'HUMAN_APPROVED pricing_decisions require decided_by';
    end if;
    if new.decided_at is null then
      new.decided_at := now();
    end if;
    if new.final_bid_rate is null and new.final_bid_amount is null then
      raise exception 'HUMAN_APPROVED pricing_decisions require final_bid_rate or final_bid_amount';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pricing_decisions_require_human_trg on public.pricing_decisions;
create trigger pricing_decisions_require_human_trg
  before insert or update on public.pricing_decisions
  for each row execute function public.pricing_decisions_require_human();
