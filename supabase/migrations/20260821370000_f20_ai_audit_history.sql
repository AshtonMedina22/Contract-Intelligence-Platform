-- F20 — Persistent Ask / Report / Citation / Tool-Trace Audit History
--
-- This is an append-oriented audit model. F4 research_runs and F6
-- analytical_runs remain separate systems of record and are linked here.
-- Retention is configuration only: F20 intentionally creates no wipe cron.

create type public.ai_run_mode as enum ('LOCATE', 'ASK_ANALYZE', 'REPORT');
create type public.ai_run_status as enum ('RUNNING', 'SUCCEEDED', 'FAILED', 'INSUFFICIENT');
create type public.ai_tool_trace_status as enum ('SUCCEEDED', 'FAILED');
create type public.ask_message_role as enum ('user', 'assistant', 'system', 'tool');

create table public.ask_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  title text not null default 'New conversation',
  purpose text not null,
  opportunity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint ask_conversations_title_present check (length(btrim(title)) > 0),
  constraint ask_conversations_purpose_present check (length(btrim(purpose)) > 0),
  constraint ask_conversations_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  parent_report_run_id uuid,
  report_kind text not null,
  purpose text not null,
  title text not null,
  query text,
  opportunity_id uuid,
  body jsonb not null,
  data_cutoff timestamptz not null,
  status public.ai_run_status not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint report_runs_kind_present check (length(btrim(report_kind)) > 0),
  constraint report_runs_purpose_present check (length(btrim(purpose)) > 0),
  constraint report_runs_title_present check (length(btrim(title)) > 0),
  constraint report_runs_parent_same_org_fkey
    foreign key (parent_report_run_id, organization_id)
    references public.report_runs (id, organization_id)
    on delete restrict,
  constraint report_runs_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  mode public.ai_run_mode not null,
  purpose text not null,
  model text,
  question text,
  answer text,
  latency_ms integer,
  data_cutoff timestamptz not null,
  status public.ai_run_status not null,
  error_message text,
  analytical_run_id uuid,
  research_run_id uuid,
  report_run_id uuid,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint ai_runs_purpose_present check (length(btrim(purpose)) > 0),
  constraint ai_runs_latency_nonnegative check (latency_ms is null or latency_ms >= 0),
  constraint ai_runs_conversation_same_org_fkey
    foreign key (conversation_id, organization_id)
    references public.ask_conversations (id, organization_id)
    on delete restrict,
  constraint ai_runs_analytical_same_org_fkey
    foreign key (analytical_run_id, organization_id)
    references public.analytical_runs (id, organization_id)
    on delete restrict,
  constraint ai_runs_research_same_org_fkey
    foreign key (research_run_id, organization_id)
    references public.research_runs (id, organization_id)
    on delete restrict,
  constraint ai_runs_report_same_org_fkey
    foreign key (report_run_id, organization_id)
    references public.report_runs (id, organization_id)
    on delete restrict
);

create table public.ask_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  ai_run_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  client_message_id text,
  role public.ask_message_role not null,
  content text,
  parts jsonb not null default '[]'::jsonb,
  sequence integer not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (conversation_id, client_message_id),
  unique (conversation_id, sequence),
  constraint ask_messages_sequence_nonnegative check (sequence >= 0),
  constraint ask_messages_conversation_same_org_fkey
    foreign key (conversation_id, organization_id)
    references public.ask_conversations (id, organization_id)
    on delete restrict,
  constraint ask_messages_run_same_org_fkey
    foreign key (ai_run_id, organization_id)
    references public.ai_runs (id, organization_id)
    on delete restrict
);

create table public.ai_tool_traces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_run_id uuid not null,
  tool_call_id text,
  tool_name text not null,
  safe_params jsonb not null default '{}'::jsonb,
  result_refs jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  latency_ms integer not null,
  status public.ai_tool_trace_status not null,
  error_message text,
  analytical_run_id uuid,
  research_run_id uuid,
  report_run_id uuid,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint ai_tool_traces_name_present check (length(btrim(tool_name)) > 0),
  constraint ai_tool_traces_latency_nonnegative check (latency_ms >= 0),
  constraint ai_tool_traces_time_order check (finished_at >= started_at),
  constraint ai_tool_traces_run_same_org_fkey
    foreign key (ai_run_id, organization_id)
    references public.ai_runs (id, organization_id)
    on delete restrict,
  constraint ai_tool_traces_analytical_same_org_fkey
    foreign key (analytical_run_id, organization_id)
    references public.analytical_runs (id, organization_id)
    on delete restrict,
  constraint ai_tool_traces_research_same_org_fkey
    foreign key (research_run_id, organization_id)
    references public.research_runs (id, organization_id)
    on delete restrict,
  constraint ai_tool_traces_report_same_org_fkey
    foreign key (report_run_id, organization_id)
    references public.report_runs (id, organization_id)
    on delete restrict
);

create table public.ai_citations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_run_id uuid not null,
  citation_index integer not null,
  title text,
  excerpt text,
  source_url text,
  internal_ref text,
  document_id uuid,
  document_version_id uuid,
  extracted_fact_id uuid,
  chunk_id uuid,
  research_run_id uuid,
  research_fact_id uuid,
  analytical_run_id uuid,
  structured_ref jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (ai_run_id, citation_index),
  constraint ai_citations_index_positive check (citation_index > 0),
  constraint ai_citations_has_reference check (
    document_id is not null
    or document_version_id is not null
    or extracted_fact_id is not null
    or chunk_id is not null
    or research_run_id is not null
    or research_fact_id is not null
    or analytical_run_id is not null
    or structured_ref is not null
    or source_url is not null
    or internal_ref is not null
  ),
  constraint ai_citations_run_same_org_fkey
    foreign key (ai_run_id, organization_id)
    references public.ai_runs (id, organization_id)
    on delete restrict,
  constraint ai_citations_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete restrict,
  constraint ai_citations_version_same_org_fkey
    foreign key (document_version_id, organization_id)
    references public.document_versions (id, organization_id)
    on delete restrict,
  constraint ai_citations_fact_same_org_fkey
    foreign key (extracted_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete restrict,
  constraint ai_citations_chunk_same_org_fkey
    foreign key (chunk_id, organization_id)
    references public.document_chunks (id, organization_id)
    on delete restrict,
  constraint ai_citations_research_run_same_org_fkey
    foreign key (research_run_id, organization_id)
    references public.research_runs (id, organization_id)
    on delete restrict,
  constraint ai_citations_research_fact_same_org_fkey
    foreign key (research_fact_id, organization_id)
    references public.research_facts (id, organization_id)
    on delete restrict,
  constraint ai_citations_analytical_same_org_fkey
    foreign key (analytical_run_id, organization_id)
    references public.analytical_runs (id, organization_id)
    on delete restrict
);

create table public.ai_audit_retention_config (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  retention_days integer not null default 2555,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_audit_retention_days_range check (retention_days between 30 and 3650)
);

create index ask_conversations_org_created_idx
  on public.ask_conversations (organization_id, created_at desc);
create index ask_messages_org_created_idx
  on public.ask_messages (organization_id, created_at desc);
create index ask_messages_conversation_created_idx
  on public.ask_messages (conversation_id, created_at);
create index ai_runs_org_created_idx
  on public.ai_runs (organization_id, created_at desc);
create index ai_runs_conversation_created_idx
  on public.ai_runs (conversation_id, created_at desc);
create index ai_tool_traces_org_created_idx
  on public.ai_tool_traces (organization_id, created_at desc);
create index ai_tool_traces_run_idx
  on public.ai_tool_traces (ai_run_id, created_at);
create index ai_citations_org_created_idx
  on public.ai_citations (organization_id, created_at desc);
create index ai_citations_run_idx
  on public.ai_citations (ai_run_id, citation_index);
create index report_runs_org_created_idx
  on public.report_runs (organization_id, created_at desc);
create index report_runs_parent_idx
  on public.report_runs (parent_report_run_id, created_at desc)
  where parent_report_run_id is not null;

comment on table public.ask_conversations is
  'F20 durable org-scoped Ask threads. Only title and updated_at are member-editable.';
comment on table public.ask_messages is
  'F20 append-only UI message snapshots. client_message_id makes stream retries idempotent.';
comment on table public.ai_runs is
  'F20 immutable completed LOCATE / ASK_ANALYZE / REPORT audit rows linked to, never merged with, F4/F6 runs.';
comment on table public.ai_tool_traces is
  'F20 append-only tool audit. safe_params must be sanitized before insert; auth headers, cookies, tokens, passwords, and secrets are forbidden.';
comment on table public.ai_citations is
  'F20 citation lineage across documents, versions, facts, chunks, F4 research, F6 analytics, and structured references.';
comment on table public.report_runs is
  'F20 immutable report snapshots. Every rerun inserts a new row and may point to parent_report_run_id.';
comment on table public.ai_audit_retention_config is
  'F20 retention configuration only. No deletion cron or arbitrary wipe mechanism is installed.';

create or replace function public.f20_conversation_title_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by
    or new.purpose is distinct from old.purpose
    or new.opportunity_id is distinct from old.opportunity_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'ask_conversations update is limited to title';
  end if;
  if length(btrim(new.title)) = 0 then
    raise exception 'conversation title is required';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger ask_conversations_title_only
before update on public.ask_conversations
for each row execute function public.f20_conversation_title_only();

alter table public.ask_conversations enable row level security;
alter table public.ask_messages enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_tool_traces enable row level security;
alter table public.ai_citations enable row level security;
alter table public.report_runs enable row level security;
alter table public.ai_audit_retention_config enable row level security;

create policy ask_conversations_select on public.ask_conversations
  for select to authenticated using (public.is_org_member(organization_id));
create policy ask_conversations_insert on public.ask_conversations
  for insert to authenticated
  with check (public.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy ask_conversations_update_title on public.ask_conversations
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy ask_messages_select on public.ask_messages
  for select to authenticated using (public.is_org_member(organization_id));
create policy ask_messages_insert on public.ask_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy ai_runs_select on public.ai_runs
  for select to authenticated using (public.is_org_member(organization_id));
create policy ai_runs_insert on public.ai_runs
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy ai_tool_traces_select on public.ai_tool_traces
  for select to authenticated using (public.is_org_member(organization_id));
create policy ai_tool_traces_insert on public.ai_tool_traces
  for insert to authenticated with check (public.is_org_member(organization_id));

create policy ai_citations_select on public.ai_citations
  for select to authenticated using (public.is_org_member(organization_id));
create policy ai_citations_insert on public.ai_citations
  for insert to authenticated with check (public.is_org_member(organization_id));

create policy report_runs_select on public.report_runs
  for select to authenticated using (public.is_org_member(organization_id));
create policy report_runs_insert on public.report_runs
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy ai_audit_retention_select on public.ai_audit_retention_config
  for select to authenticated using (public.is_org_member(organization_id));
create policy ai_audit_retention_insert on public.ai_audit_retention_config
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    and updated_by = (select auth.uid())
  );
create policy ai_audit_retention_update on public.ai_audit_retention_config
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (
    public.is_org_admin(organization_id)
    and updated_by = (select auth.uid())
  );

revoke all on public.ask_conversations from anon, authenticated;
revoke all on public.ask_messages from anon, authenticated;
revoke all on public.ai_runs from anon, authenticated;
revoke all on public.ai_tool_traces from anon, authenticated;
revoke all on public.ai_citations from anon, authenticated;
revoke all on public.report_runs from anon, authenticated;
revoke all on public.ai_audit_retention_config from anon, authenticated;

grant select, insert on public.ask_conversations to authenticated;
grant update (title, updated_at) on public.ask_conversations to authenticated;
grant select, insert on public.ask_messages to authenticated;
grant select, insert on public.ai_runs to authenticated;
grant select, insert on public.ai_tool_traces to authenticated;
grant select, insert on public.ai_citations to authenticated;
grant select, insert on public.report_runs to authenticated;
grant select, insert, update (retention_days, updated_by, updated_at)
  on public.ai_audit_retention_config to authenticated;

-- Explicitly preserve no authenticated DELETE on every F20 audit/config table.
revoke delete on public.ask_conversations from authenticated;
revoke delete on public.ask_messages from authenticated;
revoke delete on public.ai_runs from authenticated;
revoke delete on public.ai_tool_traces from authenticated;
revoke delete on public.ai_citations from authenticated;
revoke delete on public.report_runs from authenticated;
revoke delete on public.ai_audit_retention_config from authenticated;
