-- Bootstrap must bypass RLS SELECT on the new organization: INSERT ... RETURNING
-- is otherwise blocked because membership does not exist yet. The function still
-- requires auth.uid(), only inserts the caller as admin, and is not granted to anon.

drop function if exists public.create_organization_with_admin(text);

create function public.create_organization_with_admin(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if org_name is null or length(btrim(org_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name)
  values (btrim(org_name))
  returning id into new_id;

  insert into public.memberships (organization_id, user_id, role)
  values (new_id, uid, 'admin');

  return new_id;
end;
$$;

revoke all on function public.create_organization_with_admin(text) from public;
revoke all on function public.create_organization_with_admin(text) from anon;
grant execute on function public.create_organization_with_admin(text) to authenticated;
