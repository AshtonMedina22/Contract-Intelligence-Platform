-- Document-table map: competitor bid-tab rates → competitor_pricing_lines.
-- Extends promote_intelligence_from_fact for competitor_price / competitor_hourly.
-- Does not write L&P pricing_lines.

create or replace function public.promote_intelligence_from_fact(p_fact_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  fact public.extracted_facts%rowtype;
  doc public.documents%rowtype;
  field_l text;
  entity_l text;
  value_text text;
  outcome public.opportunity_outcome;
  competitor_id uuid;
  vendor text;
  rate numeric;
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
  entity_l := lower(coalesce(fact.entity, ''));
  value_text := coalesce(fact.verified_value, fact.normalized_value, fact.raw_value);

  if field_l not in (
    'outcome', 'win_loss', 'documented_reason', 'internal_analysis',
    'winner_name', 'winning_price', 'lp_price',
    'competitor_name', 'competitor_bid', 'competitor_price', 'competitor_hourly',
    'research_url', 'source_url', 'evaluation_score'
  ) and entity_l not in ('win_loss', 'competitor', 'research', 'evaluation') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not an intelligence field.');
  end if;

  if doc.opportunity_id is null and field_l not in ('research_url', 'source_url', 'competitor_name') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Document has no opportunity.');
  end if;

  if field_l = 'documented_reason' then
    insert into public.win_loss_reviews (
      organization_id, opportunity_id, source_document_id, source_fact_id, outcome, documented_reason
    )
    values (
      fact.organization_id,
      doc.opportunity_id,
      doc.id,
      fact.id,
      coalesce(public.parse_outcome(value_text), 'LOST'),
      value_text
    )
    on conflict (organization_id, opportunity_id)
    do update set
      documented_reason = excluded.documented_reason,
      source_fact_id = excluded.source_fact_id,
      updated_at = now();
    return jsonb_build_object('ok', true, 'action', 'documented_reason');
  end if;

  if field_l = 'internal_analysis' then
    insert into public.win_loss_reviews (
      organization_id, opportunity_id, source_document_id, source_fact_id, outcome, internal_analysis
    )
    values (
      fact.organization_id,
      doc.opportunity_id,
      doc.id,
      fact.id,
      coalesce((select w.outcome from public.win_loss_reviews w where w.opportunity_id = doc.opportunity_id), 'PENDING'),
      value_text
    )
    on conflict (organization_id, opportunity_id)
    do update set
      internal_analysis = excluded.internal_analysis,
      updated_at = now();
    return jsonb_build_object('ok', true, 'action', 'internal_analysis');
  end if;

  if field_l = 'winner_name' then
    insert into public.win_loss_reviews (
      organization_id, opportunity_id, source_document_id, source_fact_id, outcome, winner_name
    )
    values (fact.organization_id, doc.opportunity_id, doc.id, fact.id, 'LOST', value_text)
    on conflict (organization_id, opportunity_id)
    do update set winner_name = excluded.winner_name, updated_at = now();
    return jsonb_build_object('ok', true, 'action', 'winner_name');
  end if;

  if field_l in ('winning_price', 'lp_price') then
    insert into public.win_loss_reviews (
      organization_id, opportunity_id, source_document_id, source_fact_id, outcome,
      winning_price, lp_price
    )
    values (
      fact.organization_id,
      doc.opportunity_id,
      doc.id,
      fact.id,
      'PENDING',
      case when field_l = 'winning_price' then public.parse_rate(value_text) end,
      case when field_l = 'lp_price' then public.parse_rate(value_text) end
    )
    on conflict (organization_id, opportunity_id)
    do update set
      winning_price = coalesce(excluded.winning_price, public.win_loss_reviews.winning_price),
      lp_price = coalesce(excluded.lp_price, public.win_loss_reviews.lp_price),
      updated_at = now();
    return jsonb_build_object('ok', true, 'action', field_l);
  end if;

  if field_l = 'evaluation_score' or entity_l = 'evaluation' then
    insert into public.evaluation_scores (
      organization_id, opportunity_id, source_document_id, source_fact_id,
      respondent_name, points, notes
    )
    values (
      fact.organization_id,
      doc.opportunity_id,
      doc.id,
      fact.id,
      coalesce(nullif(btrim(fact.entity), ''), 'vendor'),
      coalesce(public.parse_rate(value_text), 0),
      value_text
    );
    return jsonb_build_object('ok', true, 'action', 'evaluation_score');
  end if;

  if field_l in (
    'competitor_name', 'competitor_bid', 'competitor_price', 'competitor_hourly'
  ) or entity_l = 'competitor' then
    vendor := case
      when field_l = 'competitor_name' then value_text
      else coalesce(nullif(btrim(fact.entity), ''), 'Unknown competitor')
    end;
    if lower(vendor) in ('hourly', 'competitor', 'rate', '') then
      vendor := 'Unknown competitor';
    end if;
    competitor_id := public.ensure_competitor(fact.organization_id, vendor);
    rate := public.parse_rate(value_text);

    if field_l in ('competitor_bid', 'competitor_price', 'competitor_hourly') and rate is not null then
      insert into public.competitor_bids (
        organization_id, competitor_id, opportunity_id, source_document_id, source_fact_id, quoted_amount, note
      )
      values (
        fact.organization_id,
        competitor_id,
        doc.opportunity_id,
        doc.id,
        fact.id,
        rate,
        value_text
      );

      insert into public.competitor_pricing_lines (
        organization_id, opportunity_id, competitor_id, vendor_name,
        labor_category, hourly_rate, source_document_id, source_fact_id, notes
      )
      values (
        fact.organization_id,
        doc.opportunity_id,
        competitor_id,
        vendor,
        'hourly',
        rate,
        doc.id,
        fact.id,
        left(coalesce(fact.source_excerpt, value_text), 500)
      );
    end if;
    return jsonb_build_object('ok', true, 'action', 'competitor', 'competitor_id', competitor_id);
  end if;

  if field_l in ('research_url', 'source_url') or entity_l = 'research' then
    insert into public.research_facts (
      organization_id,
      client_id,
      opportunity_id,
      source_document_id,
      source_url,
      excerpt,
      verification_status,
      verified_by,
      verified_at
    )
    values (
      fact.organization_id,
      doc.client_id,
      doc.opportunity_id,
      doc.id,
      value_text,
      coalesce(fact.source_excerpt, value_text),
      'HUMAN_VERIFIED',
      fact.verified_by,
      fact.verified_at
    );
    return jsonb_build_object('ok', true, 'action', 'research');
  end if;

  if field_l in ('outcome', 'win_loss') or entity_l = 'win_loss' then
    outcome := coalesce(public.parse_outcome(value_text), public.parse_outcome(field_l));
    if outcome is null then
      return jsonb_build_object('ok', false, 'action', 'skipped', 'message', 'Could not parse outcome.');
    end if;
    insert into public.win_loss_reviews (
      organization_id, opportunity_id, source_document_id, source_fact_id, outcome
    )
    values (fact.organization_id, doc.opportunity_id, doc.id, fact.id, outcome)
    on conflict (organization_id, opportunity_id)
    do update set
      outcome = excluded.outcome,
      source_fact_id = excluded.source_fact_id,
      source_document_id = excluded.source_document_id,
      updated_at = now();
    return jsonb_build_object('ok', true, 'action', 'outcome', 'outcome', outcome);
  end if;

  return jsonb_build_object('ok', true, 'action', 'skipped');
end;
$$;

comment on function public.promote_intelligence_from_fact(uuid) is
  'Win/loss + competitor + research + evaluation_score + competitor_pricing_lines from HUMAN_VERIFIED facts.';
