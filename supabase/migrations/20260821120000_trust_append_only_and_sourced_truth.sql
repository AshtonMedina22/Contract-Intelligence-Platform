-- P1 trust: append-only document_versions; sourced awards/requirements;
-- pricing awarded/current rates require verified facts; ops tables labeled planning-only.

-- 1) document_versions: members may select/insert/update, not delete
drop policy if exists document_versions_all on public.document_versions;

create policy document_versions_select on public.document_versions
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy document_versions_insert on public.document_versions
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy document_versions_update on public.document_versions
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

revoke delete on public.document_versions from authenticated;

comment on table public.document_versions is
  'Append-oriented version rows. Authenticated members cannot DELETE; Storage blobs remain insert+select only.';

-- 2) awards / requirements: insert must cite HUMAN_VERIFIED source_fact_id
create or replace function public.canonical_row_requires_verified_fact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_fact_id is null then
    raise exception '% requires source_fact_id (promote from HUMAN_VERIFIED only)', tg_table_name;
  end if;
  if not exists (
    select 1
    from public.extracted_facts f
    where f.id = new.source_fact_id
      and f.organization_id = new.organization_id
      and f.verification_status = 'HUMAN_VERIFIED'
  ) then
    raise exception '%.source_fact_id must reference a HUMAN_VERIFIED fact', tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists awards_require_verified_fact on public.awards;
create trigger awards_require_verified_fact
  before insert on public.awards
  for each row
  execute function public.canonical_row_requires_verified_fact();

drop trigger if exists requirements_require_verified_fact on public.requirements;
create trigger requirements_require_verified_fact
  before insert on public.requirements
  for each row
  execute function public.canonical_row_requires_verified_fact();

-- 3) pricing_lines: awarded/current rates require matching verified source facts
create or replace function public.pricing_lines_truth_requires_verified_fact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.awarded_rate is not null then
    if new.awarded_source_fact_id is null
       or not exists (
         select 1 from public.extracted_facts f
         where f.id = new.awarded_source_fact_id
           and f.organization_id = new.organization_id
           and f.verification_status = 'HUMAN_VERIFIED'
       )
    then
      raise exception 'pricing_lines.awarded_rate requires HUMAN_VERIFIED awarded_source_fact_id';
    end if;
  end if;
  if new.current_rate is not null then
    if new.current_source_fact_id is null
       or not exists (
         select 1 from public.extracted_facts f
         where f.id = new.current_source_fact_id
           and f.organization_id = new.organization_id
           and f.verification_status = 'HUMAN_VERIFIED'
       )
    then
      raise exception 'pricing_lines.current_rate requires HUMAN_VERIFIED current_source_fact_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pricing_lines_truth_requires_verified_fact on public.pricing_lines;
create trigger pricing_lines_truth_requires_verified_fact
  before insert or update of awarded_rate, current_rate, awarded_source_fact_id, current_source_fact_id, organization_id
  on public.pricing_lines
  for each row
  execute function public.pricing_lines_truth_requires_verified_fact();

-- 4) Ops staffing / eval: planning workspace only — not evidence-grade canonical
comment on table public.staffing_requirements is
  'Ops planning only. Not evidence-grade canonical truth; do not treat as verified historical rates without a sourced promote path.';

comment on table public.evaluation_criteria is
  'Ops planning / pursuit workspace only. Not evidence-grade canonical without a HUMAN_VERIFIED source_fact_id promote path.';
