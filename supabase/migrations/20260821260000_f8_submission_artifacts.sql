-- F8: Real Proposal Output + Google Docs working-proposal artifacts
-- Versioned, org-scoped submission artifacts. Submitted snapshots are immutable.

-- ---------------------------------------------------------------------------
-- submission_artifacts
-- ---------------------------------------------------------------------------
create table if not exists public.submission_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null,
  packet_id uuid,
  version integer not null check (version >= 1),
  generated_at timestamptz not null default now(),
  generator text not null default 'proposal-assembly',
  approval_state text not null default 'WORKING'
    check (approval_state in ('WORKING', 'READY', 'SUBMITTED', 'SUPERSEDED')),
  content_hash text not null,
  sources jsonb not null default '{}'::jsonb,
  google_doc_id text,
  google_doc_url text,
  google_sync jsonb not null default '{}'::jsonb,
  docx_storage_path text,
  portal_json jsonb,
  html_snapshot text,
  immutable boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, opportunity_id, version),
  foreign key (organization_id, opportunity_id)
    references public.opportunities (organization_id, id) on delete cascade,
  foreign key (organization_id, packet_id)
    references public.submission_packets (organization_id, id)
    on delete set null,
  constraint submission_artifacts_submitted_is_immutable
    check (
      (approval_state = 'SUBMITTED' and immutable = true)
      or (approval_state is distinct from 'SUBMITTED')
    )
);

create index if not exists submission_artifacts_opp_idx
  on public.submission_artifacts (organization_id, opportunity_id, version desc);

create index if not exists submission_artifacts_packet_idx
  on public.submission_artifacts (organization_id, packet_id)
  where packet_id is not null;

comment on table public.submission_artifacts is
  'F8 versioned working-proposal / submission snapshots. SUBMITTED rows are immutable; further edits create a new version.';
comment on column public.submission_artifacts.content_hash is
  'SHA-256 of deterministic assembly payload (template + ordered approved sections).';
comment on column public.submission_artifacts.google_doc_id is
  'External Google Docs document id when sync succeeded; null when token absent or sync skipped.';
comment on column public.submission_artifacts.immutable is
  'True once marked submitted. Trigger refuses content mutation; generate a new version instead.';

alter table public.submission_artifacts enable row level security;

drop policy if exists submission_artifacts_select on public.submission_artifacts;
create policy submission_artifacts_select on public.submission_artifacts
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists submission_artifacts_insert on public.submission_artifacts;
create policy submission_artifacts_insert on public.submission_artifacts
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists submission_artifacts_update on public.submission_artifacts;
create policy submission_artifacts_update on public.submission_artifacts
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists submission_artifacts_delete on public.submission_artifacts;
create policy submission_artifacts_delete on public.submission_artifacts
  for delete to authenticated
  using (public.is_org_member(organization_id) and immutable = false);

grant select, insert, update, delete on public.submission_artifacts to authenticated;

-- ---------------------------------------------------------------------------
-- Immutability: refuse mutate of content / identity once immutable
-- ---------------------------------------------------------------------------
create or replace function public.refuse_immutable_submission_artifact()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.immutable or old.approval_state = 'SUBMITTED' then
      raise exception 'submission_artifacts row % is immutable; create a new version instead', old.id
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.immutable or old.approval_state = 'SUBMITTED' then
    if new.organization_id is distinct from old.organization_id
      or new.opportunity_id is distinct from old.opportunity_id
      or new.packet_id is distinct from old.packet_id
      or new.version is distinct from old.version
      or new.content_hash is distinct from old.content_hash
      or new.sources is distinct from old.sources
      or new.html_snapshot is distinct from old.html_snapshot
      or new.portal_json is distinct from old.portal_json
      or new.docx_storage_path is distinct from old.docx_storage_path
      or new.generator is distinct from old.generator
      or new.approval_state is distinct from old.approval_state
      or new.immutable is distinct from old.immutable
      or new.google_doc_id is distinct from old.google_doc_id
      or new.google_doc_url is distinct from old.google_doc_url
      or new.google_sync is distinct from old.google_sync
    then
      raise exception 'submission_artifacts row % is immutable; create a new version instead', old.id
        using errcode = 'check_violation';
    end if;
  end if;

  if new.approval_state = 'SUBMITTED' and new.immutable is not true then
    new.immutable := true;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists submission_artifacts_immutable_trg on public.submission_artifacts;
create trigger submission_artifacts_immutable_trg
  before update or delete on public.submission_artifacts
  for each row
  execute function public.refuse_immutable_submission_artifact();

comment on function public.refuse_immutable_submission_artifact() is
  'F8: submitted/immutable artifacts cannot be mutated; new edits require a new version row.';
