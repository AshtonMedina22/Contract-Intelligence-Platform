-- Prompt 2C: Pilot-proven schema expansion.
-- Only entities justified by docs/benchmarks/PILOT_GAP_REPORT.md package findings.
-- Preserve tenancy, RLS, provenance FKs, four commercial truths, verification.

-- ---------------------------------------------------------------------------
-- Corpus class for A/B/C separation (VERIFY 2B: C never becomes L&P history)
-- Evidence: PILOT_CORPUS_MANIFEST classification; VERIFY2B_ACCEPTANCE
-- ---------------------------------------------------------------------------
create type public.corpus_class as enum (
  'A_LP_ORIGINATED',
  'B_LP_TIED',
  'C_COMPETITOR_TEST'
);

comment on type public.corpus_class is
  'A = L&P originated; B = L&P-tied buyer evidence; C = competitor test corpus only.';

-- Jefferson IFB: all bids rejected (PKG-05)
alter type public.opportunity_outcome add value if not exists 'NO_AWARD';

-- Rate grain for std / OT / holiday / equipment (PKG-01 golf cart; PKG-10 OT/holiday)
create type public.pricing_rate_type as enum (
  'standard',
  'overtime',
  'holiday',
  'equipment',
  'extended_hours',
  'other'
);

-- ---------------------------------------------------------------------------
-- procurement_packages — formal package unit (pilot used PKG-xx batch labels)
-- Evidence: HISTORICAL_PILOT package model; PILOT_CORPUS_MANIFEST PKG-01..13
-- ---------------------------------------------------------------------------
create table public.procurement_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  opportunity_id uuid,
  package_key text not null,
  title text not null,
  corpus_class public.corpus_class not null,
  buyer_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, package_key),
  constraint procurement_packages_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint procurement_packages_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null
);

create index procurement_packages_org_idx on public.procurement_packages (organization_id);
create index procurement_packages_class_idx on public.procurement_packages (organization_id, corpus_class);

comment on table public.procurement_packages is
  'One buyer/agency + opportunity document set. PKG keys from Historical Pilot.';
comment on column public.procurement_packages.corpus_class is
  'C rows must never promote as L&P history.';

alter table public.documents
  add column if not exists procurement_package_id uuid;

alter table public.documents
  drop constraint if exists documents_procurement_package_same_org_fkey;

alter table public.documents
  add constraint documents_procurement_package_same_org_fkey
  foreign key (procurement_package_id, organization_id)
  references public.procurement_packages (id, organization_id)
  on delete set null;

create index if not exists documents_procurement_package_id_idx
  on public.documents (organization_id, procurement_package_id);

-- ---------------------------------------------------------------------------
-- solicitation_addenda — SRC-06 "Addendum 1"
-- Evidence: PKG-03 SRC-06 extract excerpt "22-0143 Addendum 1"
-- ---------------------------------------------------------------------------
create table public.solicitation_addenda (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitation_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  addendum_number text,
  title text,
  issued_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint solicitation_addenda_solicitation_same_org_fkey
    foreign key (solicitation_id, organization_id)
    references public.solicitations (id, organization_id)
    on delete cascade,
  constraint solicitation_addenda_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint solicitation_addenda_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index solicitation_addenda_solicitation_idx
  on public.solicitation_addenda (organization_id, solicitation_id);

comment on table public.solicitation_addenda is
  'Buyer addenda attached to a solicitation. Precedence: later addendum over base RFP.';

-- ---------------------------------------------------------------------------
-- required_forms — PKG-06 Lottery IFB forms / HUB / references / cost sheet
-- Evidence: PILOT_GAP_REPORT PKG-06 missing field forms decomposition
-- ---------------------------------------------------------------------------
create table public.required_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitation_id uuid not null,
  source_fact_id uuid,
  form_name text not null,
  mandatory boolean not null default true,
  section_ref text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, solicitation_id, form_name),
  constraint required_forms_solicitation_same_org_fkey
    foreign key (solicitation_id, organization_id)
    references public.solicitations (id, organization_id)
    on delete cascade,
  constraint required_forms_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index required_forms_solicitation_idx
  on public.required_forms (organization_id, solicitation_id);

comment on table public.required_forms is
  'Government-required forms listed in solicitation (HUB, references, cost sheet, etc.).';

-- ---------------------------------------------------------------------------
-- requirements enrichment — mandatory + section_ref (PKG-06)
-- ---------------------------------------------------------------------------
alter table public.requirements
  add column if not exists mandatory boolean not null default true,
  add column if not exists section_ref text;

comment on column public.requirements.mandatory is
  'True when solicitation marks the requirement as mandatory.';
comment on column public.requirements.section_ref is
  'Source section / clause reference when known.';

-- ---------------------------------------------------------------------------
-- evaluation_scores — PKG-03 SRC-07 L&P 70.48 vs VSA 90.46
-- Evidence: PILOT_GAP_REPORT PKG-03 missing field evaluator scores
-- ---------------------------------------------------------------------------
create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  evaluation_criterion_id uuid,
  respondent_name text not null,
  competitor_id uuid,
  points numeric(10, 4) not null,
  max_points numeric(10, 4),
  rank integer,
  source_document_id uuid,
  source_fact_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint evaluation_scores_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint evaluation_scores_criterion_same_org_fkey
    foreign key (evaluation_criterion_id, organization_id)
    references public.evaluation_criteria (id, organization_id)
    on delete set null,
  constraint evaluation_scores_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete set null,
  constraint evaluation_scores_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint evaluation_scores_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index evaluation_scores_opportunity_idx
  on public.evaluation_scores (organization_id, opportunity_id);

comment on table public.evaluation_scores is
  'Evaluator scorecard rows. Do not invent loss reasons from scores alone.';

-- ---------------------------------------------------------------------------
-- awards enrichment — PKG-03 award amount $960,343; winner; rank
-- ---------------------------------------------------------------------------
alter table public.awards
  add column if not exists amount_nte numeric(14, 4),
  add column if not exists winner_name text,
  add column if not exists rank integer;

comment on column public.awards.amount_nte is
  'Award / NTE amount when stated on award instrument (e.g. Arlington staff report).';

-- ---------------------------------------------------------------------------
-- pricing_lines grain — site/post, rate type, unit, extended (PKG-01, PKG-05, PKG-10)
-- Four truth columns remain distinct.
-- ---------------------------------------------------------------------------
alter table public.pricing_lines
  add column if not exists rate_type public.pricing_rate_type not null default 'standard',
  add column if not exists site_or_post text,
  add column if not exists unit text,
  add column if not exists extended_amount numeric(14, 4),
  add column if not exists quantity numeric(14, 4);

alter table public.pricing_lines
  drop constraint if exists pricing_lines_organization_id_opportunity_id_labor_category_key;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.pricing_lines'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%labor_category%'
    and pg_get_constraintdef(oid) not like '%rate_type%';
  if cname is not null then
    execute format('alter table public.pricing_lines drop constraint %I', cname);
  end if;
end $$;

alter table public.pricing_lines
  drop constraint if exists pricing_lines_org_opp_labor_rate_site_key;

alter table public.pricing_lines
  add constraint pricing_lines_org_opp_labor_rate_site_key
  unique (organization_id, opportunity_id, labor_category, rate_type, site_or_post);

comment on column public.pricing_lines.rate_type is
  'standard / overtime / holiday / equipment / extended_hours — never collapse truths.';
comment on column public.pricing_lines.site_or_post is
  'Site or post label when rates vary by location (bid tabs).';

-- ---------------------------------------------------------------------------
-- competitor_pricing_lines — multi-vendor tabs (PKG-05 Jefferson, PKG-07/10 C tabs)
-- Evidence: L&P $18.75 on Jefferson tab; competitor rows must not write L&P pricing_lines
-- ---------------------------------------------------------------------------
create table public.competitor_pricing_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  competitor_id uuid,
  vendor_name text not null,
  labor_category text not null default 'hourly',
  rate_type public.pricing_rate_type not null default 'standard',
  site_or_post text,
  hourly_rate numeric(12, 4),
  extended_amount numeric(14, 4),
  source_document_id uuid,
  source_fact_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint competitor_pricing_lines_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint competitor_pricing_lines_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete set null,
  constraint competitor_pricing_lines_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint competitor_pricing_lines_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index competitor_pricing_lines_opportunity_idx
  on public.competitor_pricing_lines (organization_id, opportunity_id);

comment on table public.competitor_pricing_lines is
  'Bid-tab competitor/L&P rows as observed. Does not write four-truth L&P pricing_lines.';

-- ---------------------------------------------------------------------------
-- staffing_requirements enrichment — PKG-03 building/post matrix
-- ---------------------------------------------------------------------------
alter table public.staffing_requirements
  add column if not exists site_name text,
  add column if not exists building text,
  add column if not exists guard_classification text,
  add column if not exists schedule_note text;

comment on column public.staffing_requirements.site_name is
  'Facility / campus name from solicitation staffing matrix.';
comment on column public.staffing_requirements.guard_classification is
  'Armed/unarmed/Level II/III when stated.';

-- ---------------------------------------------------------------------------
-- cost_build_components — PKG-09 Tarrant wage/FICA/WC/OH/profit stack
-- Evidence: PILOT_GAP_REPORT PKG-09 cost build
-- ---------------------------------------------------------------------------
create table public.cost_build_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid,
  competitor_id uuid,
  source_document_id uuid,
  source_fact_id uuid,
  component_label text not null,
  amount numeric(14, 4),
  unit text,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint cost_build_components_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint cost_build_components_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete set null,
  constraint cost_build_components_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint cost_build_components_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index cost_build_components_org_idx
  on public.cost_build_components (organization_id);

comment on table public.cost_build_components is
  'Component cost stack (direct wage, FICA, WC, overhead, profit). Competitor test corpus OK.';

-- ---------------------------------------------------------------------------
-- purchase_orders + lines — PKG-04 TxDMV PO 0000016167
-- Evidence: 72 HR × $33.25; Extended Hours $445.55; total $2,839.55
-- ---------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid,
  contract_id uuid,
  client_id uuid,
  source_document_id uuid,
  source_fact_id uuid,
  po_number text not null,
  issued_on date,
  total_amount numeric(14, 4),
  payment_terms text,
  vehicle_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, po_number),
  constraint purchase_orders_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint purchase_orders_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null,
  constraint purchase_orders_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint purchase_orders_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint purchase_orders_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index purchase_orders_org_idx on public.purchase_orders (organization_id);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id uuid not null,
  source_fact_id uuid,
  line_label text not null,
  quantity numeric(14, 4),
  unit text,
  unit_rate numeric(12, 4),
  extended_amount numeric(14, 4),
  rate_type public.pricing_rate_type not null default 'standard',
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint purchase_order_lines_po_same_org_fkey
    foreign key (purchase_order_id, organization_id)
    references public.purchase_orders (id, organization_id)
    on delete cascade,
  constraint purchase_order_lines_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index purchase_order_lines_po_idx
  on public.purchase_order_lines (organization_id, purchase_order_id);

comment on table public.purchase_orders is
  'Government PO instrument (e.g. TxDMV 0000016167).';
comment on table public.purchase_order_lines is
  'PO line items with quantity × rate → extended.';

-- ---------------------------------------------------------------------------
-- proposal_sections — PKG-01 Williamson proposal bound with contract
-- Evidence: exec summary / pricing / EAP sections on SRC-01
-- ---------------------------------------------------------------------------
create table public.proposal_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  section_key text not null,
  title text not null,
  source_page integer,
  excerpt text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id, section_key),
  constraint proposal_sections_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint proposal_sections_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint proposal_sections_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index proposal_sections_opportunity_idx
  on public.proposal_sections (organization_id, opportunity_id);

comment on table public.proposal_sections is
  'L&P proposal section map with source page for Response UX.';

-- ---------------------------------------------------------------------------
-- federal_identifiers — PKG-01/04 TXMAS-24-99003, GSA 47QSWA22D008W
-- Evidence: PILOT_GAP_REPORT recommended federal_identifiers
-- ---------------------------------------------------------------------------
create table public.federal_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid,
  contract_id uuid,
  source_document_id uuid,
  source_fact_id uuid,
  scheme text not null,
  identifier text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, scheme, identifier),
  constraint federal_identifiers_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint federal_identifiers_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null,
  constraint federal_identifiers_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint federal_identifiers_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index federal_identifiers_org_idx on public.federal_identifiers (organization_id);

comment on table public.federal_identifiers is
  'TXMAS / GSA MAS / UEI / CAGE identifiers cited on instruments.';
comment on column public.federal_identifiers.scheme is
  'e.g. TXMAS, GSA_MAS, UEI, CAGE, SAM.';

-- ---------------------------------------------------------------------------
-- contract_service_plans — PKG-02 Allen / PKG-12 TFC Level II vs III sites
-- Evidence: service-plan UX + staffing/classifications on executed contracts
-- ---------------------------------------------------------------------------
create table public.contract_service_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  site_name text not null,
  post_label text,
  guard_classification text,
  hours_per_week numeric(10, 2),
  schedule_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, contract_id, site_name, post_label),
  constraint contract_service_plans_contract_same_org_fkey
    foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete cascade,
  constraint contract_service_plans_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint contract_service_plans_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index contract_service_plans_contract_idx
  on public.contract_service_plans (organization_id, contract_id);

comment on table public.contract_service_plans is
  'Awarded contract service-plan sites/posts/classifications.';

-- ---------------------------------------------------------------------------
-- renewals enrichment — PKG-11 Harris CPI-W
-- ---------------------------------------------------------------------------
alter table public.renewals
  add column if not exists escalation_index text,
  add column if not exists escalation_pct numeric(8, 4),
  add column if not exists option_year integer;

comment on column public.renewals.escalation_index is
  'e.g. CPI-W when stated on renewal agenda.';

-- ---------------------------------------------------------------------------
-- competitor_bids enrichment for tab grain (optional hourly)
-- ---------------------------------------------------------------------------
alter table public.competitor_bids
  add column if not exists hourly_rate numeric(12, 4),
  add column if not exists rate_type public.pricing_rate_type,
  add column if not exists rank integer;

-- ---------------------------------------------------------------------------
-- RLS + grants (tenant membership; same pattern as phase7/9/10)
-- ---------------------------------------------------------------------------
alter table public.procurement_packages enable row level security;
alter table public.solicitation_addenda enable row level security;
alter table public.required_forms enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.competitor_pricing_lines enable row level security;
alter table public.cost_build_components enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.federal_identifiers enable row level security;
alter table public.contract_service_plans enable row level security;

create policy procurement_packages_all on public.procurement_packages
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy solicitation_addenda_all on public.solicitation_addenda
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy required_forms_all on public.required_forms
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy evaluation_scores_all on public.evaluation_scores
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy competitor_pricing_lines_all on public.competitor_pricing_lines
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy cost_build_components_all on public.cost_build_components
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy purchase_orders_all on public.purchase_orders
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy purchase_order_lines_all on public.purchase_order_lines
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy proposal_sections_all on public.proposal_sections
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy federal_identifiers_all on public.federal_identifiers
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy contract_service_plans_all on public.contract_service_plans
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.procurement_packages to authenticated;
grant select, insert, update, delete on public.solicitation_addenda to authenticated;
grant select, insert, update, delete on public.required_forms to authenticated;
grant select, insert, update, delete on public.evaluation_scores to authenticated;
grant select, insert, update, delete on public.competitor_pricing_lines to authenticated;
grant select, insert, update, delete on public.cost_build_components to authenticated;
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_order_lines to authenticated;
grant select, insert, update, delete on public.proposal_sections to authenticated;
grant select, insert, update, delete on public.federal_identifiers to authenticated;
grant select, insert, update, delete on public.contract_service_plans to authenticated;
