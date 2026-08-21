-- Promote proposal_section facts into proposal_sections (PKG-01 map).

create or replace function public.promote_proposal_section_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  field_l text;
  value_text text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into fact from public.extracted_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if fact.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Only HUMAN_VERIFIED facts promote.');
  end if;

  select * into doc from public.documents where id = fact.document_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing');
  end if;
  if doc.opportunity_id is null then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'No opportunity.');
  end if;

  field_l := lower(coalesce(fact.field, ''));
  if field_l <> 'proposal_section' and lower(coalesce(fact.entity, '')) <> 'proposal' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a proposal section.');
  end if;

  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  insert into public.proposal_sections (
    organization_id, opportunity_id, source_document_id, source_fact_id,
    section_key, title, source_page, excerpt
  )
  values (
    fact.organization_id,
    doc.opportunity_id,
    doc.id,
    fact.id,
    left(regexp_replace(lower(value_text), '[^a-z0-9]+', '_', 'g'), 80),
    left(value_text, 200),
    fact.source_page,
    left(coalesce(fact.source_excerpt, value_text), 2000)
  )
  on conflict (organization_id, opportunity_id, section_key) do update set
    title = excluded.title,
    source_page = excluded.source_page,
    excerpt = excluded.excerpt,
    source_fact_id = excluded.source_fact_id,
    source_document_id = excluded.source_document_id;
  return jsonb_build_object('ok', true, 'action', 'proposal_section');
end;
$$;

revoke all on function public.promote_proposal_section_from_fact(uuid) from public;
grant execute on function public.promote_proposal_section_from_fact(uuid) to authenticated;

comment on function public.promote_proposal_section_from_fact(uuid) is
  'Maps HUMAN_VERIFIED proposal_section facts to proposal_sections.';
