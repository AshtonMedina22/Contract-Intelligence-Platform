-- Promote required_form + cost_component facts into mapped tables (PKG-06 / PKG-09).

create or replace function public.promote_required_form_from_fact(p_fact_id uuid)
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
  sol_id uuid;
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
  if field_l <> 'required_form' and lower(coalesce(fact.entity, '')) <> 'required_form' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a required form.');
  end if;

  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  if value_text is null or btrim(value_text) = '' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Empty form name.');
  end if;

  sol_id := public.ensure_solicitation(
    fact.organization_id,
    doc.opportunity_id,
    doc.client_id,
    doc.id,
    coalesce(doc.original_filename, 'Solicitation')
  );
  update public.documents
    set solicitation_id = sol_id, updated_at = now()
    where id = doc.id and solicitation_id is null;

  insert into public.required_forms (
    organization_id, solicitation_id, source_fact_id, source_document_id,
    form_name, mandatory, section_ref
  )
  values (
    fact.organization_id,
    sol_id,
    fact.id,
    doc.id,
    left(btrim(value_text), 200),
    true,
    nullif(btrim(coalesce(fact.source_section, '')), '')
  )
  on conflict (organization_id, solicitation_id, form_name)
  do update set
    source_fact_id = excluded.source_fact_id,
    source_document_id = coalesce(public.required_forms.source_document_id, excluded.source_document_id),
    section_ref = coalesce(excluded.section_ref, public.required_forms.section_ref);

  return jsonb_build_object('ok', true, 'action', 'required_form', 'solicitation_id', sol_id);
end;
$$;

create or replace function public.promote_cost_component_from_fact(p_fact_id uuid)
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
  label text;
  amt numeric;
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

  field_l := lower(coalesce(fact.field, ''));
  if field_l <> 'cost_component' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a cost component.');
  end if;

  label := nullif(btrim(coalesce(fact.entity, '')), '');
  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);
  if label is null then
    label := left(btrim(coalesce(value_text, 'component')), 120);
  end if;
  amt := public.parse_rate(value_text);

  insert into public.cost_build_components (
    organization_id, opportunity_id, source_document_id, source_fact_id,
    component_label, amount, unit, sort_order
  )
  values (
    fact.organization_id,
    doc.opportunity_id,
    doc.id,
    fact.id,
    left(label, 120),
    amt,
    case when amt is not null then 'per_hour' else null end,
    coalesce(fact.source_page, 0)
  );

  return jsonb_build_object('ok', true, 'action', 'cost_component');
end;
$$;

grant execute on function public.promote_required_form_from_fact(uuid) to authenticated;
grant execute on function public.promote_cost_component_from_fact(uuid) to authenticated;
