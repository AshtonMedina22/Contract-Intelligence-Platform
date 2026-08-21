-- F6: Governed Structured Analytics — analytical_runs audit table.
-- Parameterized metric registry executes via PostgREST under user RLS.
-- Free LLM SQL is never executed against the database.

create table public.analytical_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  question text,
  metric_id text not null,
  plan jsonb not null default '{}'::jsonb,
  plan_fingerprint text,
  explain jsonb not null default '[]'::jsonb,
  status text not null,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  interpretation text,
  limitations jsonb not null default '[]'::jsonb,
  scope text,
  data_cutoff timestamptz not null default now(),
  unique (id, organization_id),
  constraint analytical_runs_metric_present check (length(btrim(metric_id)) > 0),
  constraint analytical_runs_status_present check (length(btrim(status)) > 0)
);

create index analytical_runs_organization_id_idx on public.analytical_runs (organization_id);
create index analytical_runs_metric_id_idx on public.analytical_runs (organization_id, metric_id);
create index analytical_runs_created_at_idx on public.analytical_runs (organization_id, created_at desc);

comment on table public.analytical_runs is
  'F6 governed analytics audit. Plans are metricId+dimensions+filters only — never free SQL.';
comment on column public.analytical_runs.plan is
  'Validated AnalyticsQueryPlan JSON: { metricId, dimensions, filters, limit }.';
comment on column public.analytical_runs.plan_fingerprint is
  'Stable hash of the plan for reproducibility.';
comment on column public.analytical_runs.explain is
  'Builder explain metadata (tables, grain, fingerprint).';
comment on column public.analytical_runs.data_cutoff is
  'Wall-clock when the result was computed (corpus is live under RLS).';

alter table public.analytical_runs enable row level security;

create policy analytical_runs_all on public.analytical_runs
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.analytical_runs to authenticated;
