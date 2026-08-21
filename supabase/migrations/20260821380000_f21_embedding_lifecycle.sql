-- F21: real embedding lifecycle + model-safe hybrid retrieval.
-- pgvector/Postgres only. HUMAN_VERIFIED, classified, reusable current chunks only.

alter table public.document_chunks
  add column if not exists embedding_model text,
  add column if not exists embedding_dim integer,
  add column if not exists embedding_content_hash text,
  add column if not exists embedding_generated_at timestamptz;

-- Legacy vectors have no trustworthy model/hash lineage. They must never be compared silently.
update public.document_chunks
set embedding = null,
    embedding_model = null,
    embedding_dim = null,
    embedding_content_hash = null,
    embedding_generated_at = null
where embedding is not null
  and (
    embedding_model is null
    or embedding_dim is null
    or embedding_content_hash is null
    or embedding_generated_at is null
  );

alter table public.document_chunks
  drop constraint if exists document_chunks_embedding_metadata_consistent;

alter table public.document_chunks
  add constraint document_chunks_embedding_metadata_consistent check (
    (
      embedding is null
      and embedding_model is null
      and embedding_dim is null
      and embedding_content_hash is null
      and embedding_generated_at is null
    )
    or (
      embedding is not null
      and length(btrim(embedding_model)) > 0
      and embedding_dim = 1536
      and embedding_content_hash ~ '^[0-9a-f]{64}$'
      and embedding_generated_at is not null
    )
  );

create index if not exists document_chunks_missing_embedding_idx
  on public.document_chunks (organization_id, updated_at, id)
  where embedding is null
    and verification_status = 'HUMAN_VERIFIED'
    and reuse_status in ('APPROVED', 'REVIEW_REQUIRED')
    and is_current_version
    and data_classification in ('verified_public', 'verified_internal');

create or replace function private.f21_clear_stale_chunk_embedding()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content is distinct from old.content
     or new.verification_status <> 'HUMAN_VERIFIED'
     or new.reuse_status not in ('APPROVED', 'REVIEW_REQUIRED')
     or not new.is_current_version
     or new.data_classification not in ('verified_public', 'verified_internal') then
    new.embedding := null;
    new.embedding_model := null;
    new.embedding_dim := null;
    new.embedding_content_hash := null;
    new.embedding_generated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists document_chunks_clear_stale_embedding on public.document_chunks;
create trigger document_chunks_clear_stale_embedding
before update of content, verification_status, reuse_status, is_current_version, data_classification
on public.document_chunks
for each row execute function private.f21_clear_stale_chunk_embedding();

drop function if exists public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose
);

create function public.search_verified_knowledge(
  p_query text,
  p_query_embedding public.vector(1536) default null,
  p_for_drafting boolean default true,
  p_limit integer default 20,
  p_opportunity_id uuid default null,
  p_purpose public.retrieval_purpose default null,
  p_embedding_model text default null,
  p_embedding_dim integer default null
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
  data_classification public.data_classification,
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
  drafting boolean;
  effective_purpose text;
  vector_usable boolean :=
    p_query_embedding is not null
    and nullif(btrim(coalesce(p_embedding_model, '')), '') is not null
    and p_embedding_dim = 1536;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  if p_purpose is not null then
    drafting := public.purpose_requires_drafting_gates(p_purpose);
    effective_purpose := p_purpose::text;
  else
    drafting := coalesce(p_for_drafting, true);
    effective_purpose := case when drafting then 'PROPOSAL_DRAFTING' else 'GENERAL_QA' end;
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
    c.data_classification,
    (
      case
        when vector_usable
          and c.embedding is not null
          and c.embedding_model = p_embedding_model
          and c.embedding_dim = p_embedding_dim
        then
          (1.0 - (c.embedding <=> p_query_embedding))::real * 0.65
          + coalesce(ts_rank_cd(c.search_vector, q), 0)::real * 0.35
        else coalesce(ts_rank_cd(c.search_vector, q), 0)::real
      end
    )::real as rank,
    (
      case
        when vector_usable
          and c.embedding is not null
          and c.embedding_model = p_embedding_model
          and c.embedding_dim = p_embedding_dim
          and c.search_vector @@ q
        then 'hybrid'
        when vector_usable
          and c.embedding is not null
          and c.embedding_model = p_embedding_model
          and c.embedding_dim = p_embedding_dim
        then 'vector'
        else 'fts'
      end
    ) as match_kind
  from public.document_chunks c
  where c.verification_status = 'HUMAN_VERIFIED'
    and public.is_org_member(c.organization_id)
    and public.classification_allowed_for_purpose(c.data_classification, effective_purpose)
    and (
      not drafting
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
      or (
        vector_usable
        and c.embedding is not null
        and c.embedding_model = p_embedding_model
        and c.embedding_dim = p_embedding_dim
      )
    )
  order by rank desc, c.created_at desc
  limit lim;
end;
$$;

comment on function public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose, text, integer
) is
  'F21 purpose/F18-gated hybrid retrieval. Only exact embedding model+version and 1536-d metadata are compared; incompatible or unavailable vectors fall back to FTS.';

revoke all on function public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose, text, integer
) from public, anon;
grant execute on function public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose, text, integer
) to authenticated;
