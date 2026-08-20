-- P1 ops: staffing grid, evaluation criteria, rebid lineage, pursuit-scoped search.

alter table public.opportunities
  add column if not exists rebid_from_contract_id uuid,
  add column if not exists rebid_from_opportunity_id uuid;

comment on column public.opportunities.rebid_from_contract_id is
  'When this pursuit is a rebid, the expiring contract that triggered it.';
comment on column public.opportunities.rebid_from_opportunity_id is
  'Prior pursuit workspace cloned for rebid context.';

alter table public.opportunities
  add constraint opportunities_rebid_contract_same_org_fkey
    foreign key (rebid_from_contract_id, organization_id)
    references public.contracts (id, organization_id)
    on delete set null;

alter table public.opportunities
  add constraint opportunities_rebid_opportunity_same_org_fkey
    foreign key (rebid_from_opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null;

create table public.staffing_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  post_label text not null,
  armed boolean,
  shift_hours numeric(8, 2),
  posts_count integer,
  weekly_hours numeric(10, 2),
  clearance_note text,
  source_fact_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id, post_label),
  constraint staffing_requirements_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint staffing_requirements_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index staffing_requirements_opportunity_idx
  on public.staffing_requirements (organization_id, opportunity_id);

comment on table public.staffing_requirements is
  'Staffing post orders for a pursuit — ops-entered or promoted from verified facts.';

alter table public.staffing_requirements enable row level security;

create policy staffing_requirements_all on public.staffing_requirements
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.staffing_requirements to authenticated;

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  criterion text not null,
  weight_pct numeric(6, 2),
  source_fact_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint evaluation_criteria_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint evaluation_criteria_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index evaluation_criteria_opportunity_idx
  on public.evaluation_criteria (organization_id, opportunity_id);

comment on table public.evaluation_criteria is
  'Solicitation evaluation criteria — verified or ops-entered with optional weight.';

alter table public.evaluation_criteria enable row level security;

create policy evaluation_criteria_all on public.evaluation_criteria
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.evaluation_criteria to authenticated;

-- Pursuit-scoped verified search (optional filter by opportunity documents).
drop function if exists public.search_verified_knowledge(text, public.vector, boolean, integer);

create or replace function public.search_verified_knowledge(
  p_query text,
  p_query_embedding public.vector(1536) default null,
  p_for_drafting boolean default true,
  p_limit integer default 20,
  p_opportunity_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_version_id uuid,
  source_fact_id uuid,
  storage_bucket text,
  storage_path text,
  source_page integer,
  field text,
  content text,
  reuse_status public.reuse_status,
  rank real,
  match_kind text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q tsquery;
  lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  q := websearch_to_tsquery('english', coalesce(p_query, ''));
  if q is null or q = ''::tsquery then
    q := plainto_tsquery('english', coalesce(p_query, ''));
  end if;

  return query
  select
    c.id,
    c.document_id,
    c.document_version_id,
    c.source_fact_id,
    c.storage_bucket,
    c.storage_path,
    c.source_page,
    c.field,
    c.content,
    c.reuse_status,
    (
      case
        when p_query_embedding is not null and c.embedding is not null then
          (0.6 * coalesce(ts_rank_cd(c.search_vector, q), 0) + 0.4 * (1 - (c.embedding <=> p_query_embedding)))
        else coalesce(ts_rank_cd(c.search_vector, q), 0)
      end
    )::real as rank,
    (
      case
        when p_query_embedding is not null and c.embedding is not null and c.search_vector @@ q then 'hybrid'
        when p_query_embedding is not null and c.embedding is not null then 'vector'
        else 'fts'
      end
    ) as match_kind
  from public.document_chunks c
  where c.verification_status = 'HUMAN_VERIFIED'
    and (
      not p_for_drafting
      or (
        c.reuse_status not in ('DO_NOT_USE', 'SUPERSEDED')
        and c.is_current_version
      )
    )
    and (
      p_opportunity_id is null
      or c.document_id in (
        select d.id
        from public.documents d
        where d.opportunity_id = p_opportunity_id
          and public.is_org_member(d.organization_id)
      )
    )
    and (
      (q is not null and q <> ''::tsquery and c.search_vector @@ q)
      or (p_query_embedding is not null and c.embedding is not null)
    )
  order by rank desc, c.created_at desc
  limit lim;
end;
$$;

revoke all on function public.search_verified_knowledge(text, public.vector, boolean, integer, uuid) from public;
grant execute on function public.search_verified_knowledge(text, public.vector, boolean, integer, uuid) to authenticated;
