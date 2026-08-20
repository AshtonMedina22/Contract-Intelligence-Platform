-- Phase 10: win/loss intelligence, competitor evidence, research facts.
-- Documented reason stays separate from internal analysis. No invented prices.

create type public.opportunity_outcome as enum (
  'WON',
  'LOST',
  'PENDING',
  'CANCELLED',
  'NO_BID'
);

create table public.win_loss_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  outcome public.opportunity_outcome not null,
  documented_reason text,
  internal_analysis text,
  winner_name text,
  lp_price numeric(14, 4),
  winning_price numeric(14, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id),
  constraint win_loss_reason_not_analysis check (
    documented_reason is null
    or internal_analysis is null
    or documented_reason is distinct from internal_analysis
  ),
  constraint win_loss_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint win_loss_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint win_loss_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index win_loss_reviews_organization_id_idx on public.win_loss_reviews (organization_id);
create index win_loss_reviews_outcome_idx on public.win_loss_reviews (organization_id, outcome);

comment on column public.win_loss_reviews.documented_reason is
  'Customer/evaluator documented reason. Must not be copied into internal_analysis.';
comment on column public.win_loss_reviews.internal_analysis is
  'Internal L&P analysis. Distinct from documented_reason.';

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create index competitors_organization_id_idx on public.competitors (organization_id);

create table public.competitor_bids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  competitor_id uuid not null,
  opportunity_id uuid,
  source_document_id uuid,
  source_fact_id uuid,
  source_url text,
  quoted_amount numeric(14, 4),
  note text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint competitor_bids_has_source check (
    source_document_id is not null
    or source_fact_id is not null
    or (source_url is not null and length(btrim(source_url)) > 0)
  ),
  constraint competitor_bids_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete cascade,
  constraint competitor_bids_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint competitor_bids_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint competitor_bids_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index competitor_bids_organization_id_idx on public.competitor_bids (organization_id);
create index competitor_bids_competitor_id_idx on public.competitor_bids (competitor_id);

create table public.research_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  competitor_id uuid,
  opportunity_id uuid,
  source_document_id uuid,
  source_url text not null,
  title text,
  excerpt text,
  published_on date,
  retrieved_at timestamptz not null default now(),
  verification_status public.fact_verification_status not null default 'AI_EXTRACTED',
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint research_facts_verified_requires_actor check (
    verification_status <> 'HUMAN_VERIFIED'
    or (verified_by is not null and verified_at is not null)
  ),
  constraint research_facts_url_present check (length(btrim(source_url)) > 0),
  constraint research_facts_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint research_facts_competitor_same_org_fkey
    foreign key (competitor_id, organization_id)
    references public.competitors (id, organization_id)
    on delete set null,
  constraint research_facts_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete set null,
  constraint research_facts_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null
);

create index research_facts_organization_id_idx on public.research_facts (organization_id);
create index research_facts_status_idx on public.research_facts (organization_id, verification_status);

alter table public.win_loss_reviews enable row level security;
alter table public.competitors enable row level security;
alter table public.competitor_bids enable row level security;
alter table public.research_facts enable row level security;

create policy win_loss_reviews_all on public.win_loss_reviews
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy competitors_all on public.competitors
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy competitor_bids_all on public.competitor_bids
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy research_facts_all on public.research_facts
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.win_loss_reviews to authenticated;
grant select, insert, update, delete on public.competitors to authenticated;
grant select, insert, update, delete on public.competitor_bids to authenticated;
grant select, insert, update, delete on public.research_facts to authenticated;

create or replace function public.ensure_competitor(p_organization_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing uuid;
  cleaned text := nullif(btrim(p_name), '');
begin
  if cleaned is null then
    raise exception 'Competitor name is required';
  end if;
  select id into existing
  from public.competitors
  where organization_id = p_organization_id
    and name = cleaned;
  if existing is not null then
    return existing;
  end if;
  insert into public.competitors (organization_id, name)
  values (p_organization_id, cleaned)
  returning id into existing;
  return existing;
end;
$$;

create or replace function public.parse_outcome(raw text)
returns public.opportunity_outcome
language plpgsql
immutable
set search_path = public
as $$
declare
  blob text := lower(coalesce(raw, ''));
begin
  if blob ~ '\bwon\b|\baward' then
    return 'WON';
  end if;
  if blob ~ '\blost\b|\bnot awarded\b|\bunsuccessful' then
    return 'LOST';
  end if;
  if blob ~ 'no.?bid' then
    return 'NO_BID';
  end if;
  if blob ~ 'cancel' then
    return 'CANCELLED';
  end if;
  if blob ~ 'pending|awaiting' then
    return 'PENDING';
  end if;
  return null;
end;
$$;

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
    'competitor_name', 'competitor_bid', 'competitor_price',
    'research_url', 'source_url'
  ) and entity_l not in ('win_loss', 'competitor', 'research') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Not an intelligence field.');
  end if;

  if doc.opportunity_id is null and field_l not in ('research_url', 'source_url', 'competitor_name') then
    return jsonb_build_object('ok', true, 'action', 'skipped', 'message', 'Document has no opportunity.');
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

  if field_l in ('competitor_name', 'competitor_bid', 'competitor_price') or entity_l = 'competitor' then
    competitor_id := public.ensure_competitor(
      fact.organization_id,
      case when field_l = 'competitor_name' then value_text else coalesce(nullif(btrim(fact.entity), ''), 'Unknown competitor') end
    );
    if field_l in ('competitor_bid', 'competitor_price') then
      insert into public.competitor_bids (
        organization_id, competitor_id, opportunity_id, source_document_id, source_fact_id, quoted_amount, note
      )
      values (
        fact.organization_id,
        competitor_id,
        doc.opportunity_id,
        doc.id,
        fact.id,
        public.parse_rate(value_text),
        value_text
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

  return jsonb_build_object('ok', true, 'action', 'skipped');
end;
$$;

revoke all on function public.ensure_competitor(uuid, text) from public;
revoke all on function public.parse_outcome(text) from public;
revoke all on function public.promote_intelligence_from_fact(uuid) from public;
grant execute on function public.ensure_competitor(uuid, text) to authenticated;
grant execute on function public.parse_outcome(text) to authenticated;
grant execute on function public.promote_intelligence_from_fact(uuid) to authenticated;
