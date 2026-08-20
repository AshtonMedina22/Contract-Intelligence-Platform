-- Prompt 2C follow-up: keep promote_verified_fact aligned with pricing_lines grain.
-- Unique key is now (org, opportunity, labor_category, rate_type, site_or_post).

update public.pricing_lines
set site_or_post = ''
where site_or_post is null;

alter table public.pricing_lines
  alter column site_or_post set default '',
  alter column site_or_post set not null;

create or replace function public.promote_verified_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  truth public.commercial_truth;
  category text;
  rate numeric;
  line public.pricing_lines%rowtype;
  existing_rate numeric;
  sol_id uuid;
  result jsonb;
  field_l text;
  entity_l text;
  rate_kind public.pricing_rate_type;
  site_key text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into fact from public.extracted_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing', 'message', 'Fact not found.');
  end if;

  if fact.verification_status <> 'HUMAN_VERIFIED' then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Only HUMAN_VERIFIED facts promote.');
  end if;

  select * into doc from public.documents where id = fact.document_id;
  if not found then
    return jsonb_build_object('ok', false, 'action', 'missing', 'message', 'Document not found.');
  end if;

  if doc.opportunity_id is null then
    return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Document has no opportunity; identity promotion first.');
  end if;

  truth := coalesce(
    doc.commercial_truth,
    public.infer_commercial_truth(doc.document_type, doc.original_filename)
  );

  field_l := lower(coalesce(fact.field, ''));
  entity_l := lower(coalesce(fact.entity, ''));

  if field_l in ('client_name', 'client', 'customer_name', 'opportunity_title', 'opportunity', 'solicitation_title')
     or entity_l in ('client', 'opportunity') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Identity fields use clients/opportunities, not pricing_lines.');
  end if;

  if field_l like 'page_%_text' then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Page blobs are not canonical rates.');
  end if;

  if field_l in ('requirement', 'requirement_text', 'shall') or entity_l = 'requirement' then
    if truth is not null and truth <> 'requested' then
      insert into public.validation_exceptions (organization_id, document_id, code, message)
      values (
        fact.organization_id,
        fact.document_id,
        'precedence_requirement',
        'Requirements come from the solicitation (requested). This document truth is ' || truth::text || '.'
      );
      return jsonb_build_object('ok', false, 'action', 'conflict', 'message', 'Requirements cannot be written from awarded/current/proposed sources.');
    end if;
    sol_id := public.ensure_solicitation(
      fact.organization_id,
      doc.opportunity_id,
      doc.client_id,
      doc.id,
      coalesce(nullif(btrim(fact.verified_value), ''), fact.normalized_value, 'Solicitation')
    );
    update public.documents
      set solicitation_id = sol_id, updated_at = now()
      where id = doc.id and solicitation_id is null;
    insert into public.requirements (organization_id, solicitation_id, source_fact_id, statement)
    values (
      fact.organization_id,
      sol_id,
      fact.id,
      coalesce(fact.verified_value, fact.normalized_value, fact.raw_value)
    );
    return jsonb_build_object('ok', true, 'action', 'requirement', 'solicitation_id', sol_id);
  end if;

  if field_l in ('award_notice', 'award', 'awarded_on') or entity_l = 'award' then
    if truth is not null and truth <> 'awarded' then
      insert into public.validation_exceptions (organization_id, document_id, code, message)
      values (
        fact.organization_id,
        fact.document_id,
        'precedence_award',
        'Awards come from award/PO/executed contract sources, not ' || coalesce(truth::text, 'unknown') || '.'
      );
      return jsonb_build_object('ok', false, 'action', 'conflict', 'message', 'Award facts cannot be written from the requested/proposed/current document.');
    end if;
    insert into public.awards (
      organization_id, opportunity_id, source_document_id, source_fact_id, notice
    )
    values (
      fact.organization_id,
      doc.opportunity_id,
      doc.id,
      fact.id,
      coalesce(fact.verified_value, fact.normalized_value, fact.raw_value)
    )
    on conflict (organization_id, opportunity_id)
    do update set
      notice = excluded.notice,
      source_fact_id = excluded.source_fact_id,
      source_document_id = excluded.source_document_id;
    return jsonb_build_object('ok', true, 'action', 'award');
  end if;

  if field_l in ('solicitation_number', 'solicitation_title') or entity_l = 'solicitation' then
    sol_id := public.ensure_solicitation(
      fact.organization_id,
      doc.opportunity_id,
      doc.client_id,
      doc.id,
      coalesce(fact.verified_value, fact.normalized_value, fact.raw_value, 'Solicitation')
    );
    if field_l = 'solicitation_number' then
      update public.solicitations
        set solicitation_number = coalesce(fact.verified_value, fact.normalized_value, fact.raw_value),
            updated_at = now()
        where id = sol_id;
    end if;
    return jsonb_build_object('ok', true, 'action', 'solicitation', 'solicitation_id', sol_id);
  end if;

  rate := public.parse_rate(coalesce(fact.verified_value, fact.normalized_value, fact.raw_value));
  if rate is null then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Value is not a rate.');
  end if;

  if truth is null then
    if field_l like 'requested%' then
      truth := 'requested';
    elsif field_l like 'proposed%' then
      truth := 'proposed';
    elsif field_l like 'awarded%' then
      truth := 'awarded';
    elsif field_l like 'current%' then
      truth := 'current';
    else
      return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Set documents.commercial_truth or document_type before promoting a rate.');
    end if;
  end if;

  if field_l like 'requested%' and truth <> 'requested' then
    insert into public.validation_exceptions (organization_id, document_id, code, message)
    values (
      fact.organization_id,
      fact.document_id,
      'precedence_requested',
      'Requested rates only come from RFP/RFQ/IFB/addenda/Q&A.'
    );
    return jsonb_build_object('ok', false, 'action', 'conflict', 'message', 'This document cannot write requested_rate.');
  end if;

  category := nullif(btrim(coalesce(fact.entity, '')), '');
  if category is null or category in ('workbook', 'document', 'pricing') then
    category := 'unspecified';
  end if;

  if field_l like '%overtime%' or field_l like '%_ot' or entity_l like '%overtime%' then
    rate_kind := 'overtime';
  elsif field_l like '%holiday%' or entity_l like '%holiday%' then
    rate_kind := 'holiday';
  elsif field_l like '%equipment%' or field_l like '%vehicle%' or entity_l like '%equipment%' then
    rate_kind := 'equipment';
  elsif field_l like '%extended%' then
    rate_kind := 'extended_hours';
  else
    rate_kind := 'standard';
  end if;

  site_key := coalesce(nullif(btrim(coalesce(fact.source_section, '')), ''), '');

  insert into public.pricing_lines (
    organization_id, opportunity_id, labor_category, rate_type, site_or_post
  )
  values (fact.organization_id, doc.opportunity_id, category, rate_kind, site_key)
  on conflict (organization_id, opportunity_id, labor_category, rate_type, site_or_post) do nothing;

  select * into line
  from public.pricing_lines
  where organization_id = fact.organization_id
    and opportunity_id = doc.opportunity_id
    and labor_category = category
    and rate_type = rate_kind
    and site_or_post = site_key;

  if truth = 'requested' then
    existing_rate := line.requested_rate;
  elsif truth = 'proposed' then
    existing_rate := line.proposed_rate;
  elsif truth = 'awarded' then
    existing_rate := line.awarded_rate;
  else
    existing_rate := line.current_rate;
  end if;

  if existing_rate is not null and existing_rate <> rate then
    insert into public.validation_exceptions (organization_id, document_id, code, message)
    values (
      fact.organization_id,
      fact.document_id,
      'rate_conflict_' || truth::text,
      format(
        'Refusing to overwrite %s rate %s with %s. Keep both sources; do not collapse truths.',
        truth::text,
        existing_rate::text,
        rate::text
      )
    );
    return jsonb_build_object(
      'ok', false,
      'action', 'conflict',
      'truth', truth,
      'existing', existing_rate,
      'incoming', rate,
      'pricing_line_id', line.id
    );
  end if;

  if truth = 'requested' then
    update public.pricing_lines
      set requested_rate = rate,
          requested_source_fact_id = fact.id,
          updated_at = now()
      where id = line.id;
  elsif truth = 'proposed' then
    update public.pricing_lines
      set proposed_rate = rate,
          proposed_source_fact_id = fact.id,
          updated_at = now()
      where id = line.id;
  elsif truth = 'awarded' then
    update public.pricing_lines
      set awarded_rate = rate,
          awarded_source_fact_id = fact.id,
          updated_at = now()
      where id = line.id;
  else
    update public.pricing_lines
      set current_rate = rate,
          current_source_fact_id = fact.id,
          updated_at = now()
      where id = line.id;
  end if;

  result := jsonb_build_object(
    'ok', true,
    'action', 'rate',
    'truth', truth,
    'rate', rate,
    'labor_category', category,
    'rate_type', rate_kind,
    'pricing_line_id', line.id
  );
  return result;
end;
$$;
