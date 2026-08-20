-- Phase 7: solicitations, requirements, four-truth pricing lines, awards.
-- AI still never auto-promotes. Do not create the full MASTER table list.

create type public.commercial_truth as enum (
  'requested',
  'proposed',
  'awarded',
  'current'
);

create or replace function public.infer_commercial_truth(doc_type text, filename text)
returns public.commercial_truth
language plpgsql
immutable
set search_path = public
as $$
declare
  blob text := lower(coalesce(doc_type, '') || ' ' || coalesce(filename, ''));
begin
  if blob ~ '(amendment|modification|option|renewal)' then
    return 'current';
  end if;
  if blob ~ '(award|purchase.?order|\bpo\b|bid.?tab)' then
    return 'awarded';
  end if;
  if blob ~ '(proposal|quote|pricing|workbook)' then
    return 'proposed';
  end if;
  if blob ~ '(rfp|rfq|ifb|solicitation|addendum|q\s*&?\s*a)' then
    return 'requested';
  end if;
  if blob ~ '\bcontract\b' then
    return 'awarded';
  end if;
  return null;
end;
$$;

alter table public.documents
  add column if not exists commercial_truth public.commercial_truth,
  add column if not exists solicitation_id uuid;

comment on column public.documents.commercial_truth is
  'Which of the four commercial truths this source document is allowed to write. Award files cannot overwrite requested.';

create table public.solicitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  client_id uuid,
  source_document_id uuid,
  title text not null,
  solicitation_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id),
  constraint solicitations_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint solicitations_client_same_org_fkey
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint solicitations_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null
);

create index solicitations_organization_id_idx on public.solicitations (organization_id);
create index solicitations_opportunity_id_idx on public.solicitations (opportunity_id);

alter table public.documents
  add constraint documents_solicitation_same_org_fkey
  foreign key (solicitation_id, organization_id)
  references public.solicitations (id, organization_id)
  on delete set null;

create index documents_solicitation_id_idx on public.documents (solicitation_id);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitation_id uuid not null,
  source_fact_id uuid,
  statement text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint requirements_solicitation_same_org_fkey
    foreign key (solicitation_id, organization_id)
    references public.solicitations (id, organization_id)
    on delete cascade,
  constraint requirements_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index requirements_organization_id_idx on public.requirements (organization_id);
create index requirements_solicitation_id_idx on public.requirements (solicitation_id);

create table public.pricing_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  labor_category text not null,
  requested_rate numeric(12, 4),
  proposed_rate numeric(12, 4),
  awarded_rate numeric(12, 4),
  current_rate numeric(12, 4),
  requested_source_fact_id uuid,
  proposed_source_fact_id uuid,
  awarded_source_fact_id uuid,
  current_source_fact_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id, labor_category),
  constraint pricing_lines_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint pricing_lines_requested_fact_same_org_fkey
    foreign key (requested_source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint pricing_lines_proposed_fact_same_org_fkey
    foreign key (proposed_source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint pricing_lines_awarded_fact_same_org_fkey
    foreign key (awarded_source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null,
  constraint pricing_lines_current_fact_same_org_fkey
    foreign key (current_source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index pricing_lines_organization_id_idx on public.pricing_lines (organization_id);
create index pricing_lines_opportunity_id_idx on public.pricing_lines (opportunity_id);

comment on table public.pricing_lines is
  'Four commercial truths stay in four columns. Never collapse into a single rate.';

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  source_document_id uuid,
  source_fact_id uuid,
  notice text,
  awarded_on date,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, opportunity_id),
  constraint awards_opportunity_same_org_fkey
    foreign key (opportunity_id, organization_id)
    references public.opportunities (id, organization_id)
    on delete cascade,
  constraint awards_document_same_org_fkey
    foreign key (source_document_id, organization_id)
    references public.documents (id, organization_id)
    on delete set null,
  constraint awards_fact_same_org_fkey
    foreign key (source_fact_id, organization_id)
    references public.extracted_facts (id, organization_id)
    on delete set null
);

create index awards_organization_id_idx on public.awards (organization_id);
create index awards_opportunity_id_idx on public.awards (opportunity_id);

alter table public.solicitations enable row level security;
alter table public.requirements enable row level security;
alter table public.pricing_lines enable row level security;
alter table public.awards enable row level security;

create policy solicitations_all on public.solicitations
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy requirements_all on public.requirements
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy pricing_lines_all on public.pricing_lines
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy awards_all on public.awards
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.solicitations to authenticated;
grant select, insert, update, delete on public.requirements to authenticated;
grant select, insert, update, delete on public.pricing_lines to authenticated;
grant select, insert, update, delete on public.awards to authenticated;

create or replace function public.parse_rate(raw text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text;
begin
  if raw is null or length(btrim(raw)) = 0 then
    return null;
  end if;
  cleaned := regexp_replace(lower(btrim(raw)), '[^0-9.\-]', '', 'g');
  if cleaned is null or cleaned = '' or cleaned = '-' or cleaned = '.' then
    return null;
  end if;
  begin
    return cleaned::numeric;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.ensure_solicitation(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_client_id uuid,
  p_document_id uuid,
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
  select id into existing
  from public.solicitations
  where organization_id = p_organization_id
    and opportunity_id = p_opportunity_id;
  if existing is not null then
    return existing;
  end if;
  insert into public.solicitations (
    organization_id, opportunity_id, client_id, source_document_id, title
  )
  values (
    p_organization_id,
    p_opportunity_id,
    p_client_id,
    p_document_id,
    coalesce(nullif(btrim(p_title), ''), 'Solicitation')
  )
  returning id into existing;
  return existing;
end;
$$;

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

  -- A later award cannot write requested_rate.
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

  insert into public.pricing_lines (organization_id, opportunity_id, labor_category)
  values (fact.organization_id, doc.opportunity_id, category)
  on conflict (organization_id, opportunity_id, labor_category) do nothing;

  select * into line
  from public.pricing_lines
  where organization_id = fact.organization_id
    and opportunity_id = doc.opportunity_id
    and labor_category = category;

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
    'pricing_line_id', line.id
  );
  return result;
end;
$$;

revoke all on function public.infer_commercial_truth(text, text) from public;
revoke all on function public.parse_rate(text) from public;
revoke all on function public.ensure_solicitation(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.promote_verified_fact(uuid) from public;
grant execute on function public.infer_commercial_truth(text, text) to authenticated;
grant execute on function public.parse_rate(text) to authenticated;
grant execute on function public.ensure_solicitation(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.promote_verified_fact(uuid) to authenticated;
