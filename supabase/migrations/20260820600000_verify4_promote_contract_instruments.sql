-- VERIFY 4 — extend promote_contract_from_fact for pilot instrument grain.
-- Evidence: PKG-04 PO, PKG-12 service plan / Amend 4, PKG-01/04 federal IDs.
-- Appends history; never deletes prior amendments / PO lines / service-plan rows.

create or replace function public.promote_contract_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  truth public.commercial_truth;
  field_l text;
  entity_l text;
  value_text text;
  parsed date;
  v_contract_id uuid;
  kind public.compliance_kind;
  po_id uuid;
  scheme_text text;
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
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'No opportunity on document.');
  end if;

  truth := coalesce(
    doc.commercial_truth,
    public.infer_commercial_truth(doc.document_type, doc.original_filename)
  );
  field_l := lower(coalesce(fact.field, ''));
  entity_l := lower(coalesce(fact.entity, ''));
  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);

  if field_l not in (
    'contract_end', 'expiration_date', 'end_date', 'contract_expiration', 'verified_end_on',
    'contract_start', 'start_date',
    'contract_number', 'contract_title', 'contract_name',
    'insurance_expiration', 'license_expiration', 'certification_expiration',
    'amendment', 'amendment_note', 'amendment_number', 'amendment_title',
    'option_exercise_by',
    'renewal_notice', 'renewal_due', 'escalation_index',
    'po_number', 'purchase_order', 'payment_terms', 'vehicle_ref',
    'site_name', 'post_label', 'guard_classification', 'hours_per_week', 'schedule_note',
    'federal_identifier', 'contract_vehicle', 'txmas', 'gsa'
  ) and entity_l not in (
    'contract', 'amendment', 'renewal', 'compliance',
    'purchase_order', 'service_plan', 'federal'
  ) then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not a contract field.');
  end if;

  if truth is not null and truth not in ('awarded', 'current') then
    insert into public.validation_exceptions (organization_id, document_id, code, message)
    values (
      fact.organization_id,
      fact.document_id,
      'precedence_contract',
      'Contracts come from awarded/current instruments, not ' || truth::text || '.'
    );
    return jsonb_build_object('ok', false, 'action', 'conflict', 'message', 'RFP/proposal sources cannot write contracts.');
  end if;

  v_contract_id := public.ensure_contract(
    fact.organization_id,
    doc.opportunity_id,
    doc.client_id,
    doc.id,
    fact.id,
    coalesce(
      case when field_l in ('contract_title', 'contract_name') then value_text end,
      doc.original_filename,
      'Contract'
    )
  );

  if field_l in ('contract_end', 'expiration_date', 'end_date', 'contract_expiration', 'verified_end_on') then
    parsed := public.parse_iso_date(value_text);
    if parsed is null then
      return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Could not parse verified end date.');
    end if;
    update public.contracts
      set verified_end_on = parsed,
          source_fact_id = fact.id,
          source_document_id = doc.id,
          updated_at = now()
      where id = v_contract_id;
    perform public.refresh_contract_alerts();
    return jsonb_build_object('ok', true, 'action', 'contract_end', 'contract_id', v_contract_id, 'verified_end_on', parsed);
  end if;

  if field_l in ('contract_start', 'start_date') then
    parsed := public.parse_iso_date(value_text);
    update public.contracts
      set start_on = parsed, updated_at = now()
      where id = v_contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_start', 'contract_id', v_contract_id);
  end if;

  if field_l = 'contract_number' then
    update public.contracts
      set contract_number = value_text, updated_at = now()
      where id = v_contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_number', 'contract_id', v_contract_id);
  end if;

  if field_l in ('contract_title', 'contract_name') then
    update public.contracts
      set title = value_text, updated_at = now()
      where id = v_contract_id;
    return jsonb_build_object('ok', true, 'action', 'contract_title', 'contract_id', v_contract_id);
  end if;

  if field_l in ('insurance_expiration', 'license_expiration', 'certification_expiration')
     or entity_l = 'compliance' then
    kind := case
      when field_l like 'insurance%' then 'insurance'::public.compliance_kind
      when field_l like 'license%' then 'license'::public.compliance_kind
      when field_l like 'certification%' then 'certification'::public.compliance_kind
      else 'other'::public.compliance_kind
    end;
    insert into public.compliance_items (
      organization_id, contract_id, source_fact_id, kind, statement, expires_on
    )
    values (
      fact.organization_id,
      v_contract_id,
      fact.id,
      kind,
      value_text,
      public.parse_iso_date(value_text)
    );
    return jsonb_build_object('ok', true, 'action', 'compliance', 'contract_id', v_contract_id);
  end if;

  if field_l = 'amendment_number' then
    insert into public.contract_amendments (
      organization_id, contract_id, source_document_id, source_fact_id,
      amendment_number, note
    )
    values (
      fact.organization_id, v_contract_id, doc.id, fact.id,
      value_text, coalesce(fact.entity, 'amendment')
    );
    return jsonb_build_object('ok', true, 'action', 'amendment', 'contract_id', v_contract_id, 'amendment_number', value_text);
  end if;

  if field_l = 'amendment_title' then
    insert into public.contract_amendments (
      organization_id, contract_id, source_document_id, source_fact_id,
      title, note
    )
    values (
      fact.organization_id, v_contract_id, doc.id, fact.id,
      value_text, value_text
    );
    return jsonb_build_object('ok', true, 'action', 'amendment', 'contract_id', v_contract_id, 'title', value_text);
  end if;

  if field_l in ('amendment', 'amendment_note') or entity_l = 'amendment' then
    insert into public.contract_amendments (
      organization_id, contract_id, source_document_id, source_fact_id, note
    )
    values (fact.organization_id, v_contract_id, doc.id, fact.id, value_text);
    return jsonb_build_object('ok', true, 'action', 'amendment', 'contract_id', v_contract_id);
  end if;

  if field_l = 'option_exercise_by' then
    insert into public.contract_options (
      organization_id, contract_id, source_fact_id, label, exercise_by
    )
    values (fact.organization_id, v_contract_id, fact.id, coalesce(fact.entity, 'option'), public.parse_iso_date(value_text));
    return jsonb_build_object('ok', true, 'action', 'option', 'contract_id', v_contract_id);
  end if;

  if field_l in ('renewal_notice', 'renewal_due') or entity_l = 'renewal' then
    insert into public.renewals (
      organization_id, contract_id, source_fact_id, notice, notice_due_on
    )
    values (fact.organization_id, v_contract_id, fact.id, value_text, public.parse_iso_date(value_text));
    return jsonb_build_object('ok', true, 'action', 'renewal', 'contract_id', v_contract_id);
  end if;

  if field_l = 'escalation_index' then
    insert into public.renewals (
      organization_id, contract_id, source_fact_id, notice, escalation_index
    )
    values (fact.organization_id, v_contract_id, fact.id, value_text, value_text);
    return jsonb_build_object('ok', true, 'action', 'renewal_escalation', 'contract_id', v_contract_id);
  end if;

  if field_l in ('po_number', 'purchase_order') or entity_l = 'purchase_order' then
    insert into public.purchase_orders (
      organization_id, contract_id, opportunity_id, client_id,
      source_document_id, source_fact_id, po_number
    )
    values (
      fact.organization_id, v_contract_id, doc.opportunity_id, doc.client_id,
      doc.id, fact.id, value_text
    )
    on conflict (organization_id, po_number)
    do update set
      contract_id = excluded.contract_id,
      source_document_id = coalesce(public.purchase_orders.source_document_id, excluded.source_document_id),
      source_fact_id = excluded.source_fact_id,
      updated_at = now()
    returning id into po_id;
    return jsonb_build_object('ok', true, 'action', 'purchase_order', 'contract_id', v_contract_id, 'purchase_order_id', po_id);
  end if;

  if field_l = 'payment_terms' then
    select p.id into po_id
    from public.purchase_orders p
    where p.organization_id = fact.organization_id
      and p.contract_id = v_contract_id
    order by p.created_at desc
    limit 1;
    if po_id is null then
      return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'No purchase order to attach payment terms.');
    end if;
    update public.purchase_orders
      set payment_terms = value_text, source_fact_id = fact.id, updated_at = now()
      where id = po_id;
    return jsonb_build_object('ok', true, 'action', 'payment_terms', 'contract_id', v_contract_id, 'purchase_order_id', po_id);
  end if;

  if field_l = 'vehicle_ref' then
    select p.id into po_id
    from public.purchase_orders p
    where p.organization_id = fact.organization_id
      and p.contract_id = v_contract_id
    order by p.created_at desc
    limit 1;
    if po_id is not null then
      update public.purchase_orders
        set vehicle_ref = value_text, source_fact_id = fact.id, updated_at = now()
        where id = po_id;
    end if;
    insert into public.federal_identifiers (
      organization_id, contract_id, opportunity_id,
      source_document_id, source_fact_id, scheme, identifier
    )
    values (
      fact.organization_id, v_contract_id, doc.opportunity_id,
      doc.id, fact.id, 'contract_vehicle', value_text
    )
    on conflict (organization_id, scheme, identifier)
    do update set
      contract_id = excluded.contract_id,
      source_document_id = coalesce(public.federal_identifiers.source_document_id, excluded.source_document_id),
      source_fact_id = excluded.source_fact_id;
    return jsonb_build_object('ok', true, 'action', 'vehicle_ref', 'contract_id', v_contract_id);
  end if;

  if field_l in ('site_name', 'post_label', 'guard_classification', 'hours_per_week', 'schedule_note')
     or entity_l = 'service_plan' then
    insert into public.contract_service_plans (
      organization_id, contract_id, source_document_id, source_fact_id,
      site_name, post_label, guard_classification, hours_per_week, schedule_note, notes
    )
    values (
      fact.organization_id,
      v_contract_id,
      doc.id,
      fact.id,
      case when field_l = 'site_name' or entity_l = 'service_plan' then value_text else coalesce(fact.entity, 'site') end,
      case when field_l = 'post_label' then value_text else null end,
      case when field_l = 'guard_classification' then value_text else null end,
      case
        when field_l = 'hours_per_week' and value_text ~ '^[0-9]+(\.[0-9]+)?$'
          then value_text::numeric
        else null
      end,
      case when field_l = 'schedule_note' then value_text else null end,
      case
        when field_l not in ('site_name', 'post_label', 'guard_classification', 'hours_per_week', 'schedule_note')
          then value_text
        else null
      end
    );
    return jsonb_build_object('ok', true, 'action', 'service_plan', 'contract_id', v_contract_id);
  end if;

  if field_l in ('federal_identifier', 'contract_vehicle', 'txmas', 'gsa')
     or entity_l = 'federal' then
    scheme_text := case
      when field_l = 'txmas' then 'TXMAS'
      when field_l = 'gsa' then 'GSA'
      when field_l = 'contract_vehicle' then 'contract_vehicle'
      else coalesce(nullif(fact.entity, ''), 'federal_identifier')
    end;
    insert into public.federal_identifiers (
      organization_id, contract_id, opportunity_id,
      source_document_id, source_fact_id, scheme, identifier
    )
    values (
      fact.organization_id, v_contract_id, doc.opportunity_id,
      doc.id, fact.id, scheme_text, value_text
    )
    on conflict (organization_id, scheme, identifier)
    do update set
      contract_id = excluded.contract_id,
      source_document_id = coalesce(public.federal_identifiers.source_document_id, excluded.source_document_id),
      source_fact_id = excluded.source_fact_id;
    return jsonb_build_object('ok', true, 'action', 'federal_identifier', 'contract_id', v_contract_id);
  end if;

  return jsonb_build_object('ok', true, 'action', 'skipped');
end;
$$;

comment on function public.promote_contract_from_fact(uuid) is
  'Promotes HUMAN_VERIFIED awarded/current contract facts. Appends amendments/options/renewals/POs/service plans/federal IDs; never erases history.';
