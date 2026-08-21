-- F18: Data Classification + Trust Authority
-- Classification is independent from fact verification and from corpus_class A/B/C.

do $$
begin
  create type public.data_classification as enum (
    'verified_public',
    'verified_internal',
    'internal_unverified',
    'illustrative_demo'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.documents
  add column if not exists data_classification public.data_classification not null
  default 'internal_unverified';

alter table public.extracted_facts
  add column if not exists data_classification public.data_classification not null
  default 'internal_unverified';

alter table public.document_chunks
  add column if not exists data_classification public.data_classification not null
  default 'internal_unverified';

comment on type public.data_classification is
  'Trust authority axis, independent from verification_status and procurement_packages.corpus_class.';
comment on column public.documents.data_classification is
  'Human-controlled source authority. AI may not elevate to verified_public or verified_internal.';
comment on column public.extracted_facts.data_classification is
  'Denormalized from documents.data_classification; fact verification remains an independent axis.';
comment on column public.document_chunks.data_classification is
  'Denormalized from documents.data_classification; promotion copies but never upgrades authority.';

create index if not exists documents_classification_idx
  on public.documents (organization_id, data_classification);
create index if not exists extracted_facts_classification_idx
  on public.extracted_facts (organization_id, data_classification, verification_status);
create index if not exists document_chunks_classification_idx
  on public.document_chunks (organization_id, data_classification, verification_status);

-- Existing rows deliberately stay internal_unverified. Verification status and corpus class
-- are not evidence that a human made a classification decision.
update public.extracted_facts f
set data_classification = d.data_classification
from public.documents d
where d.id = f.document_id
  and d.organization_id = f.organization_id;

update public.document_chunks c
set data_classification = d.data_classification
from public.documents d
where d.id = c.document_id
  and d.organization_id = c.organization_id;

create or replace function private.f18_guard_document_classification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  auth_marker text := current_setting('app.classification_authorized', true);
begin
  if tg_op = 'INSERT' then
    if new.data_classification in ('verified_public', 'verified_internal')
       and auth_marker is distinct from 'human' then
      raise exception 'Verified data classification requires set_document_data_classification';
    end if;
    return new;
  end if;

  if new.data_classification is distinct from old.data_classification
     and coalesce(auth_marker, '') not in ('human', 'ingest_demo') then
    raise exception 'Data classification changes require an authorized action';
  end if;

  if auth_marker = 'ingest_demo'
     and new.data_classification <> 'illustrative_demo' then
    raise exception 'Ingest classification path may only assign illustrative_demo';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_classification_guard on public.documents;
create trigger documents_classification_guard
before insert or update of data_classification on public.documents
for each row execute function private.f18_guard_document_classification();

create or replace function private.f18_inherit_document_classification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  inherited public.data_classification;
begin
  select d.data_classification
    into inherited
  from public.documents d
  where d.id = new.document_id
    and d.organization_id = new.organization_id;

  if inherited is null then
    raise exception 'Classification inheritance requires a same-organization document';
  end if;
  new.data_classification := inherited;
  return new;
end;
$$;

drop trigger if exists extracted_facts_inherit_classification on public.extracted_facts;
create trigger extracted_facts_inherit_classification
before insert or update of document_id, organization_id, data_classification
on public.extracted_facts
for each row execute function private.f18_inherit_document_classification();

drop trigger if exists document_chunks_inherit_classification on public.document_chunks;
create trigger document_chunks_inherit_classification
before insert or update of document_id, organization_id, data_classification
on public.document_chunks
for each row execute function private.f18_inherit_document_classification();

create or replace function private.f18_cascade_document_classification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data_classification is distinct from old.data_classification then
    update public.extracted_facts
    set data_classification = new.data_classification
    where document_id = new.id
      and organization_id = new.organization_id;

    update public.document_chunks
    set data_classification = new.data_classification,
        updated_at = now()
    where document_id = new.id
      and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_cascade_classification on public.documents;
create trigger documents_cascade_classification
after update of data_classification on public.documents
for each row execute function private.f18_cascade_document_classification();

create or replace function public.set_document_data_classification(
  p_document_id uuid,
  p_data_classification public.data_classification,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  doc public.documents%rowtype;
  old_class public.data_classification;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if p_data_classification is null then
    raise exception 'data_classification is required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Classification reason is required';
  end if;

  select * into doc
  from public.documents
  where id = p_document_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;

  if not public.has_org_role(
    doc.organization_id,
    array['admin', 'verifier']::public.membership_role[]
  ) then
    raise exception 'Not authorized: verify.promote or admin required';
  end if;

  old_class := doc.data_classification;
  perform set_config('app.classification_authorized', 'human', true);
  update public.documents
  set data_classification = p_data_classification,
      updated_at = now()
  where id = p_document_id;

  insert into public.verification_events (
    organization_id, extracted_fact_id, actor_id, action, note
  )
  values (
    doc.organization_id,
    null,
    auth.uid(),
    'SET_DATA_CLASSIFICATION',
    left(format(
      '%s -> %s: %s',
      old_class::text,
      p_data_classification::text,
      btrim(p_reason)
    ), 1000)
  );

  return jsonb_build_object(
    'ok', true,
    'action', 'classification_set',
    'document_id', p_document_id,
    'from', old_class,
    'to', p_data_classification
  );
end;
$$;

revoke all on function public.set_document_data_classification(
  uuid, public.data_classification, text
) from public, anon;
grant execute on function public.set_document_data_classification(
  uuid, public.data_classification, text
) to authenticated;

-- Explicit ingest-only path for demo/test packages. It cannot assign verified authority.
create or replace function public.register_ingested_document_classified(
  p_organization_id uuid,
  p_document_id uuid,
  p_version_id uuid,
  p_batch_id uuid,
  p_batch_label text,
  p_client_id uuid,
  p_opportunity_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_sha256 text,
  p_storage_path text,
  p_byte_size bigint,
  p_source_drive_file_id text,
  p_data_classification public.data_classification default 'internal_unverified'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  result jsonb;
  registered_document_id uuid;
  actual_classification public.data_classification;
begin
  if p_data_classification not in ('internal_unverified', 'illustrative_demo') then
    raise exception 'Ingest may only assign internal_unverified or illustrative_demo';
  end if;

  result := public.register_ingested_document(
    p_organization_id,
    p_document_id,
    p_version_id,
    p_batch_id,
    p_batch_label,
    p_client_id,
    p_opportunity_id,
    p_original_filename,
    p_mime_type,
    p_sha256,
    p_storage_path,
    p_byte_size,
    p_source_drive_file_id
  );

  registered_document_id := nullif(result->>'document_id', '')::uuid;
  if coalesce((result->>'duplicate')::boolean, false) = false
     and registered_document_id is not null
     and p_data_classification = 'illustrative_demo' then
    perform set_config('app.classification_authorized', 'ingest_demo', true);
    update public.documents
    set data_classification = 'illustrative_demo'
    where id = registered_document_id
      and organization_id = p_organization_id;
  end if;

  select d.data_classification
    into actual_classification
  from public.documents d
  where d.id = registered_document_id
    and d.organization_id = p_organization_id;

  -- A checksum duplicate keeps the classification of the existing evidence record.
  -- Never report the requested ingest classification as though it changed that record.
  return result || jsonb_build_object(
    'data_classification',
    coalesce(actual_classification, p_data_classification)
  );
end;
$$;

revoke all on function public.register_ingested_document_classified(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, bigint, text,
  public.data_classification
) from public, anon;
grant execute on function public.register_ingested_document_classified(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, bigint, text,
  public.data_classification
) to authenticated;

alter type public.retrieval_purpose add value if not exists 'DEMO_TEST';

create or replace function public.classification_allowed_for_purpose(
  p_data_classification public.data_classification,
  p_purpose text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case upper(coalesce(p_purpose, ''))
    when 'DEMO_TEST' then true
    when 'LOCATE' then p_data_classification <> 'illustrative_demo'
    when 'PROPOSAL_DRAFTING' then p_data_classification = 'verified_internal'
    when 'COMPLIANCE_REVIEW' then p_data_classification = 'verified_internal'
    when 'LOSS_ANALYSIS' then p_data_classification = 'verified_internal'
    else p_data_classification in ('verified_public', 'verified_internal')
  end;
$$;

comment on function public.classification_allowed_for_purpose(public.data_classification, text) is
  'F18 eligibility matrix. Demo is default-denied; only explicit DEMO_TEST includes it.';

drop function if exists public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose
);

create function public.search_verified_knowledge(
  p_query text,
  p_query_embedding public.vector(1536) default null,
  p_for_drafting boolean default true,
  p_limit integer default 20,
  p_opportunity_id uuid default null,
  p_purpose public.retrieval_purpose default null
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
        when p_query_embedding is not null and c.embedding is not null then
          (1.0 - (c.embedding <=> p_query_embedding))::real * 0.65
          + coalesce(ts_rank_cd(c.search_vector, q), 0)::real * 0.35
        else coalesce(ts_rank_cd(c.search_vector, q), 0)::real
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
      or (p_query_embedding is not null and c.embedding is not null)
    )
  order by rank desc, c.created_at desc
  limit lim;
end;
$$;

revoke all on function public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose
) from public, anon;
grant execute on function public.search_verified_knowledge(
  text, public.vector, boolean, integer, uuid, public.retrieval_purpose
) to authenticated;

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
    organization_id, document_id, document_version_id, source_fact_id,
    chunk_index, field, content, source_page, source_section,
    storage_bucket, storage_path, verification_status, reuse_status,
    is_current_version, data_classification
  )
  values (
    fact.organization_id, fact.document_id, fact.document_version_id, fact.id,
    0, fact.field, body, fact.source_page, fact.source_section,
    ver.storage_bucket, ver.storage_path, 'HUMAN_VERIFIED', 'REVIEW_REQUIRED',
    ver.is_current, fact.data_classification
  )
  on conflict (source_fact_id) where source_fact_id is not null
  do update set
    content = excluded.content,
    field = excluded.field,
    source_page = excluded.source_page,
    source_section = excluded.source_section,
    storage_path = excluded.storage_path,
    is_current_version = excluded.is_current_version,
    verification_status = 'HUMAN_VERIFIED',
    data_classification = excluded.data_classification,
    reuse_status = case
      when document_chunks.reuse_status in ('APPROVED', 'DO_NOT_USE', 'SUPERSEDED', 'REVIEW_REQUIRED')
        then document_chunks.reuse_status
      else 'REVIEW_REQUIRED'
    end,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'action', 'chunked',
    'reuse_status', 'REVIEW_REQUIRED',
    'data_classification', fact.data_classification
  );
end;
$$;

comment on function public.promote_knowledge_chunk_from_fact(uuid) is
  'Promotes a HUMAN_VERIFIED fact and copies its document classification without upgrading it.';
