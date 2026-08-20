-- Phase 11: verified knowledge chunks, FTS, pgvector. No Pinecone/Qdrant.
-- Drafting retrieval excludes DO_NOT_USE, SUPERSEDED, non-current versions, and unverified staging.

create extension if not exists vector;

create type public.reuse_status as enum (
  'APPROVED',
  'REVIEW',
  'DO_NOT_USE',
  'SUPERSEDED'
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  document_version_id uuid not null,
  source_fact_id uuid,
  chunk_index integer not null default 0,
  field text,
  content text not null,
  source_page integer,
  source_section text,
  storage_bucket text not null default 'evidence',
  storage_path text not null,
  verification_status public.fact_verification_status not null,
  reuse_status public.reuse_status not null default 'APPROVED',
  is_current_version boolean not null default true,
  embedding public.vector(1536),
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(field, '') || ' ' || coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint document_chunks_content_present check (length(btrim(content)) > 0),
  constraint document_chunks_verified_only check (verification_status = 'HUMAN_VERIFIED'),
  constraint document_chunks_document_same_org_fkey
    foreign key (document_id, organization_id)
    references public.documents (id, organization_id)
    on delete cascade,
  constraint document_chunks_version_same_org_fkey
    foreign key (document_version_id, organization_id)
    references public.document_versions (id, organization_id)
    on delete cascade,
  constraint document_chunks_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete cascade
);

create unique index document_chunks_source_fact_id_uidx
  on public.document_chunks (source_fact_id)
  where source_fact_id is not null;

create index document_chunks_organization_id_idx on public.document_chunks (organization_id);
create index document_chunks_search_idx on public.document_chunks using gin (search_vector);
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;
create index document_chunks_drafting_idx
  on public.document_chunks (organization_id, reuse_status, is_current_version)
  where verification_status = 'HUMAN_VERIFIED';

alter table public.document_chunks enable row level security;

create policy document_chunks_all on public.document_chunks
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.document_chunks to authenticated;

create or replace function public.promote_knowledge_chunk_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  ver public.document_versions%rowtype;
  body text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into fact from public.extracted_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if fact.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Only HUMAN_VERIFIED facts become chunks.');
  end if;

  select * into ver from public.document_versions where id = fact.document_version_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;

  body := nullif(btrim(concat_ws(
    E'\n',
    nullif(btrim(coalesce(fact.field, '')), ''),
    nullif(btrim(coalesce(fact.verified_value, fact.normalized_value, fact.raw_value, '')), ''),
    nullif(btrim(coalesce(fact.source_excerpt, '')), '')
  )), '');
  if body is null then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Empty verified content.');
  end if;

  insert into public.document_chunks (
    organization_id,
    document_id,
    document_version_id,
    source_fact_id,
    chunk_index,
    field,
    content,
    source_page,
    source_section,
    storage_bucket,
    storage_path,
    verification_status,
    reuse_status,
    is_current_version
  )
  values (
    fact.organization_id,
    fact.document_id,
    fact.document_version_id,
    fact.id,
    0,
    fact.field,
    body,
    fact.source_page,
    fact.source_section,
    ver.storage_bucket,
    ver.storage_path,
    'HUMAN_VERIFIED',
    'APPROVED',
    ver.is_current
  )
  on conflict (source_fact_id) where source_fact_id is not null
  do update set
    content = excluded.content,
    field = excluded.field,
    source_page = excluded.source_page,
    source_section = excluded.source_section,
    storage_path = excluded.storage_path,
    is_current_version = excluded.is_current_version,
    updated_at = now();

  return jsonb_build_object('ok', true, 'action', 'chunked');
end;
$$;

create or replace function public.search_verified_knowledge(
  p_query text,
  p_query_embedding public.vector(1536) default null,
  p_for_drafting boolean default true,
  p_limit integer default 20
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
      (q is not null and q <> ''::tsquery and c.search_vector @@ q)
      or (p_query_embedding is not null and c.embedding is not null)
    )
  order by rank desc, c.created_at desc
  limit lim;
end;
$$;

revoke all on function public.promote_knowledge_chunk_from_fact(uuid) from public;
revoke all on function public.search_verified_knowledge(text, public.vector, boolean, integer) from public;
grant execute on function public.promote_knowledge_chunk_from_fact(uuid) to authenticated;
grant execute on function public.search_verified_knowledge(text, public.vector, boolean, integer) to authenticated;
