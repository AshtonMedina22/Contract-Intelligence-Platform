-- Opportunity workspace metadata + planning-only cost models (not canonical truth).

create type public.opportunity_stage as enum (
  'INTAKE',
  'ANALYSIS',
  'PRICING',
  'DRAFTING',
  'SUBMITTED',
  'AWARDED',
  'CLOSED'
);

create type public.go_no_go as enum ('PENDING', 'GO', 'NO_GO');

alter table public.opportunities
  add column if not exists stage public.opportunity_stage not null default 'INTAKE',
  add column if not exists response_due_on date,
  add column if not exists service_type text,
  add column if not exists notes text,
  add column if not exists go_no_go public.go_no_go not null default 'PENDING';

comment on column public.opportunities.stage is 'Ops workflow stage for this pursuit — not outcome.';
comment on column public.opportunities.response_due_on is 'Proposal or quote response deadline when known.';
comment on column public.opportunities.service_type is 'e.g. armed, unarmed, patrol, executive protection.';
comment on column public.opportunities.go_no_go is 'Human go/no-go decision — never inferred by AI.';

create index opportunities_stage_idx on public.opportunities (organization_id, stage);
create index opportunities_due_idx on public.opportunities (organization_id, response_due_on);

-- Planning-only internal cost stack. Does NOT replace pricing_lines.proposed_rate.
create table public.pricing_cost_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  labor_category text not null,
  base_wage numeric(14, 4),
  fringe numeric(14, 4),
  burden_pct numeric(8, 4),
  workers_comp numeric(14, 4),
  insurance numeric(14, 4),
  supervision numeric(14, 4),
  equipment numeric(14, 4),
  overhead_pct numeric(8, 4),
  target_margin_pct numeric(8, 4),
  planned_proposed_rate numeric(14, 4),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id, labor_category),
  constraint pricing_cost_models_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade
);

create index pricing_cost_models_opportunity_idx
  on public.pricing_cost_models (organization_id, opportunity_id);

comment on table public.pricing_cost_models is
  'Planning-only L&P cost model for margin analysis. Canonical proposed_rate lives in pricing_lines after HUMAN_VERIFIED promotion.';

alter table public.pricing_cost_models enable row level security;

create policy pricing_cost_models_all on public.pricing_cost_models
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.pricing_cost_models to authenticated;
