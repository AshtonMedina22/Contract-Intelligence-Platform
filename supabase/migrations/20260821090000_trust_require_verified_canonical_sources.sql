-- Trust harden: canonical RAG chunks and contracts must cite HUMAN_VERIFIED facts.
-- Direct PostgREST inserts that only set verification_status='HUMAN_VERIFIED' as a label are blocked.

-- document_chunks: require a real verified fact (label alone is not enough)
delete from public.document_chunks
where source_fact_id is null
   or not exists (
     select 1
     from public.extracted_facts f
     where f.id = document_chunks.source_fact_id
       and f.organization_id = document_chunks.organization_id
       and f.verification_status = 'HUMAN_VERIFIED'
   );

alter table public.document_chunks
  alter column source_fact_id set not null;

create or replace function public.document_chunks_require_verified_fact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status is distinct from 'HUMAN_VERIFIED' then
    raise exception 'document_chunks.verification_status must be HUMAN_VERIFIED';
  end if;
  if not exists (
    select 1
    from public.extracted_facts f
    where f.id = new.source_fact_id
      and f.organization_id = new.organization_id
      and f.verification_status = 'HUMAN_VERIFIED'
  ) then
    raise exception 'document_chunks.source_fact_id must reference a HUMAN_VERIFIED fact';
  end if;
  return new;
end;
$$;

drop trigger if exists document_chunks_require_verified_fact on public.document_chunks;
create trigger document_chunks_require_verified_fact
  before insert or update of source_fact_id, verification_status, organization_id
  on public.document_chunks
  for each row
  execute function public.document_chunks_require_verified_fact();

-- contracts: new rows must cite a HUMAN_VERIFIED fact (promote / win-from-verified only)
create or replace function public.contracts_require_verified_fact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_fact_id is null then
    raise exception 'contracts.source_fact_id is required (create via verified promotion, not blank insert)';
  end if;
  if not exists (
    select 1
    from public.extracted_facts f
    where f.id = new.source_fact_id
      and f.organization_id = new.organization_id
      and f.verification_status = 'HUMAN_VERIFIED'
  ) then
    raise exception 'contracts.source_fact_id must reference a HUMAN_VERIFIED fact';
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_require_verified_fact on public.contracts;
create trigger contracts_require_verified_fact
  before insert on public.contracts
  for each row
  execute function public.contracts_require_verified_fact();

create or replace function public.ensure_contract(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_client_id uuid,
  p_document_id uuid,
  p_fact_id uuid,
  p_title text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing uuid;
begin
  if p_fact_id is null then
    raise exception 'ensure_contract requires a HUMAN_VERIFIED source fact';
  end if;
  if not exists (
    select 1
    from public.extracted_facts f
    where f.id = p_fact_id
      and f.organization_id = p_organization_id
      and f.verification_status = 'HUMAN_VERIFIED'
  ) then
    raise exception 'ensure_contract source fact must be HUMAN_VERIFIED';
  end if;

  if p_opportunity_id is not null then
    select id into existing
    from public.contracts
    where organization_id = p_organization_id
      and opportunity_id = p_opportunity_id;
  end if;
  if existing is not null then
    return existing;
  end if;
  insert into public.contracts (
    organization_id, opportunity_id, client_id, source_document_id, source_fact_id, title
  )
  values (
    p_organization_id,
    p_opportunity_id,
    p_client_id,
    p_document_id,
    p_fact_id,
    coalesce(nullif(btrim(p_title), ''), 'Contract')
  )
  returning id into existing;
  return existing;
end;
$$;

-- Defense in depth for private automation helpers
revoke all on function private.refresh_contract_alerts() from public, anon, authenticated;
revoke all on function private.run_intelligence_automation() from public, anon, authenticated;
revoke all on function private.ensure_automation_event(uuid, text, text, uuid, text, text, text, date) from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'refresh_approval_reminder_alerts'
  ) then
    execute 'revoke all on function private.refresh_approval_reminder_alerts() from public, anon, authenticated';
  end if;
exception
  when undefined_function then
    null;
end;
$$;
