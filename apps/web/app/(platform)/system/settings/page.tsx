import { createOrganization, updateMembershipRole } from "@/app/(platform)/system/settings/actions";
import { SettingsNav } from "@/components/section-tabs";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Suspense } from "react";
import { memberHasPermission } from "@/lib/auth/permissions";
import type { MembershipRole } from "@/lib/supabase/database.types";

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = user
    ? await supabase
        .from("memberships")
        .select("role, organization_id, user_id")
        .eq("user_id", user.id)
    : { data: [] as { role: string; organization_id: string; user_id: string }[] };

  const orgIds = (memberships ?? []).map((m) => m.organization_id);
  const { data: orgs } =
    orgIds.length > 0
      ? await supabase.from("organizations").select("id, name").in("id", orgIds)
      : { data: [] as { id: string; name: string }[] };

  const orgName = (id: string) => orgs?.find((o) => o.id === id)?.name ?? id;

  const adminOrgIds = (memberships ?? [])
    .filter((m) => memberHasPermission(m.role, "org.admin"))
    .map((m) => m.organization_id);

  const { data: orgMembers } =
    adminOrgIds.length > 0
      ? await supabase
          .from("memberships")
          .select("organization_id, user_id, role")
          .in("organization_id", adminOrgIds)
      : { data: [] as { organization_id: string; user_id: string; role: string }[] };

  return (
    <div className="max-w-xl space-y-6">
      <SettingsNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization membership. Document intake is under Data Ops.
        </p>
      </div>

      {!user ? (
        <p className="text-sm">
          Sign in at{" "}
          <a className="underline" href="/auth/login">
            /auth/login
          </a>{" "}
          first.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Your organizations</h2>
            {memberships && memberships.length > 0 ? (
              <ul className="text-sm">
                {memberships.map((row) => (
                  <li key={row.organization_id}>
                    {orgName(row.organization_id)} — {row.role}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None yet.</p>
            )}
          </div>

          {params.error ? (
            <p className="text-sm text-red-600">{params.error}</p>
          ) : null}

          {adminOrgIds.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Member roles (org admin)</h2>
              <p className="text-xs text-muted-foreground">
                Roles: admin · importer · verifier · bidder · executive. No viewer role.
              </p>
              <ul className="space-y-3">
                {(orgMembers ?? []).map((m) => (
                  <li key={`${m.organization_id}:${m.user_id}`} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      {orgName(m.organization_id)} · {m.user_id.slice(0, 8)}…
                    </p>
                    <form action={updateMembershipRole} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="organization_id" value={m.organization_id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <div className="space-y-1">
                        <Label htmlFor={`role-${m.user_id}`}>Role</Label>
                        <select
                          id={`role-${m.user_id}`}
                          name="role"
                          defaultValue={m.role}
                          className="flex h-9 rounded-md border bg-background px-2 text-sm"
                        >
                          {(
                            ["admin", "importer", "verifier", "bidder", "executive"] as MembershipRole[]
                          ).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" size="sm" variant="outline">
                        Update role
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form action={createOrganization} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Create organization</Label>
              <Input id="name" name="name" placeholder="L&P Global Security" />
            </div>
            <Button type="submit">Create as admin</Button>
          </form>
        </>
      )}
    </div>
  );
}

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}
