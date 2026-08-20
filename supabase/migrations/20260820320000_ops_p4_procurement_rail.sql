-- Pass 4 ops: LPGS procurement rail + solicitation packet fields. Values are ops-entered, never inferred.

alter table public.opportunities
  add column if not exists procurement_rail text,
  add column if not exists solicitation_kind text,
  add column if not exists site_location text,
  add column if not exists submission_method text,
  add column if not exists coverage_start_on date,
  add column if not exists vehicle_ref text;

alter table public.opportunities
  drop constraint if exists opportunities_procurement_rail_check;
alter table public.opportunities
  add constraint opportunities_procurement_rail_check
  check (
    procurement_rail is null
    or procurement_rail in (
      'COMMERCIAL_QUOTE',
      'TX_MUNICIPAL_ISD',
      'TXMAS',
      'GSA_FEDERAL',
      'OTHER_GOV'
    )
  );

alter table public.opportunities
  drop constraint if exists opportunities_solicitation_kind_check;
alter table public.opportunities
  add constraint opportunities_solicitation_kind_check
  check (
    solicitation_kind is null
    or solicitation_kind in (
      'QUOTE',
      'RFQ',
      'RFP',
      'IFB',
      'TASK_ORDER',
      'REBID'
    )
  );

comment on column public.opportunities.procurement_rail is
  'How this pursuit is bought: commercial quote, TX municipal/ISD, TXMAS, GSA/federal. Ops-entered.';
comment on column public.opportunities.solicitation_kind is
  'Instrument type: quote, RFQ, RFP, IFB, GSA/TXMAS task order, or contract rebid. Ops-entered.';
comment on column public.opportunities.site_location is
  'Buyer site / coverage city. Ops-entered from solicitation or quote request.';
comment on column public.opportunities.submission_method is
  'How the response is delivered (portal, email, sealed bid). Ops-entered.';
comment on column public.opportunities.coverage_start_on is
  'Requested coverage / POP start if stated. Ops-entered.';
comment on column public.opportunities.vehicle_ref is
  'Schedule or contract vehicle id if used (e.g. TXMAS-24-99003, GSA MAS). Ops-entered — not auto-filled.';

alter table public.staffing_requirements
  add column if not exists labor_category text;

comment on column public.staffing_requirements.labor_category is
  'Optional explicit match to pricing_cost_models.labor_category. Never inferred from armed flag.';
