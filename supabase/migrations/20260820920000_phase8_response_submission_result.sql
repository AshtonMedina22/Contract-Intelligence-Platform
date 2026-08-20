-- Canonical Phase 8 — Response Builder / Submission / Result
-- Pursuit-central workflow. AI never invents L&P facts or auto-approves.

-- ---------------------------------------------------------------------------
-- Outcome enum extensions (Lost/Not Selected already LOST; add NO_AWARD)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'opportunity_outcome' and e.enumlabel = 'NO_AWARD'
  ) then
    alter type public.opportunity_outcome add value 'NO_AWARD';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Requirements matrix enrichment
-- ---------------------------------------------------------------------------
alter table public.requirements
  add column if not exists scored boolean not null default false,
  add column if not exists weight_pct numeric(8, 4),
  add column if not exists response_required boolean not null default true,
  add column if not exists attachment_required boolean not null default false,
  add column if not exists form_name text,
  add column if not exists owner_name text,
  add column if not exists source_page integer,
  add column if not exists verification_note text,
  add column if not exists matrix_status text not null default 'OPEN'
    check (matrix_status in (
      'OPEN',
      'DRAFTING',
      'DRAFTED',
      'APPROVED',
      'L_AND_P_INPUT_REQUIRED'
    ));

comment on column public.requirements.matrix_status is
  'Pursuit response progress for this requirement. Distinct from extraction verification.';
comment on column public.requirements.scored is
  'True when the solicitation scores this requirement (vs pass/fail mandatory).';

-- ---------------------------------------------------------------------------
-- Requirement responses (Tiptap drafts + grounded GPT metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.requirement_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  requirement_id uuid not null,
  draft_html text not null default '',
  draft_json jsonb,
  evidence_state text not null default 'L_AND_P_INPUT_REQUIRED'
    check (evidence_state in (
      'VERIFIED_DRAFT_AVAILABLE',
      'REVIEW_REQUIRED',
      'L_AND_P_INPUT_REQUIRED'
    )),
  draft_status text not null default 'EMPTY'
    check (draft_status in ('EMPTY', 'DRAFT', 'APPROVED')),
  sources_used jsonb not null default '[]'::jsonb,
  assumptions text,
  missing_information text,
  confidence text,
  generated_at timestamptz,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, opportunity_id, requirement_id),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade,
  foreign key (organization_id, requirement_id)
    references public.requirements (organization_id, id) on delete cascade
);

create index if not exists requirement_responses_opp_idx
  on public.requirement_responses (organization_id, opportunity_id);

alter table public.requirement_responses enable row level security;

drop policy if exists requirement_responses_all on public.requirement_responses;
create policy requirement_responses_all on public.requirement_responses
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.requirement_responses to authenticated;

comment on table public.requirement_responses is
  'Per-requirement response drafts. GPT may only fill from allowed evidence; L&P facts never invented.';

-- ---------------------------------------------------------------------------
-- Configurable internal approvals
-- ---------------------------------------------------------------------------
create table if not exists public.pursuit_approval_layers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  layer_key text not null
    check (layer_key in ('content', 'operations', 'pricing', 'compliance', 'executive')),
  enabled boolean not null default false,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'changes_requested', 'rejected')),
  approver_id uuid references auth.users (id),
  notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, opportunity_id, layer_key),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade
);

create index if not exists pursuit_approval_layers_opp_idx
  on public.pursuit_approval_layers (organization_id, opportunity_id);

alter table public.pursuit_approval_layers enable row level security;

drop policy if exists pursuit_approval_layers_all on public.pursuit_approval_layers;
create policy pursuit_approval_layers_all on public.pursuit_approval_layers
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.pursuit_approval_layers to authenticated;

comment on table public.pursuit_approval_layers is
  'Optional approval layers per pursuit. Disabled layers are config-only; never hard-coded for every RFP.';

-- ---------------------------------------------------------------------------
-- Submission packet + checklist
-- ---------------------------------------------------------------------------
create table if not exists public.submission_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  due_at timestamptz,
  question_deadline_at timestamptz,
  submission_method text,
  portal_recipient text,
  final_output_version text,
  google_docs_url text,
  submitted_at timestamptz,
  confirmation_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, opportunity_id),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade
);

create index if not exists submission_packets_opp_idx
  on public.submission_packets (organization_id, opportunity_id);

alter table public.submission_packets enable row level security;

drop policy if exists submission_packets_all on public.submission_packets;
create policy submission_packets_all on public.submission_packets
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.submission_packets to authenticated;

create table if not exists public.submission_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  item_key text not null,
  label text not null,
  required boolean not null default true,
  completed boolean not null default false,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, opportunity_id, item_key),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade
);

create index if not exists submission_checklist_items_opp_idx
  on public.submission_checklist_items (organization_id, opportunity_id);

alter table public.submission_checklist_items enable row level security;

drop policy if exists submission_checklist_items_all on public.submission_checklist_items;
create policy submission_checklist_items_all on public.submission_checklist_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.submission_checklist_items to authenticated;

comment on table public.submission_checklist_items is
  'Submission readiness: forms, schedules, refs, insurance, certs, affidavits, signatures, notarization, addenda, attachments, approvals.';

-- ---------------------------------------------------------------------------
-- Win/loss result enrichment (scores + evaluator comments)
-- ---------------------------------------------------------------------------
alter table public.win_loss_reviews
  add column if not exists lp_score numeric(10, 4),
  add column if not exists winning_score numeric(10, 4),
  add column if not exists rank integer,
  add column if not exists evaluator_comments text;

comment on column public.win_loss_reviews.lp_score is
  'L&P total evaluation score when published — never invented.';
comment on column public.win_loss_reviews.winning_score is
  'Winning respondent score when published — never invented.';
