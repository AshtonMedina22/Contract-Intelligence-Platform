-- Phase 2 advisor fixes:
-- 1. Organizations are created only through create_organization_with_admin.
-- 2. Membership inserts are admin-only; the first-member exception is no longer
--    needed now that bootstrap is a single DEFINER transaction.

drop policy if exists organizations_insert on public.organizations;

drop policy if exists memberships_insert on public.memberships;

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.is_org_admin(organization_id));
