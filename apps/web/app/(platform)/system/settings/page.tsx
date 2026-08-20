import { createOrganization } from "@/app/(platform)/system/settings/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Suspense } from "react";

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
        .select("role, organization_id")
        .eq("user_id", user.id)
    : { data: [] as { role: string; organization_id: string }[] };

  const orgIds = (memberships ?? []).map((m) => m.organization_id);
  const { data: orgs } =
    orgIds.length > 0
      ? await supabase.from("organizations").select("id, name").in("id", orgIds)
      : { data: [] as { id: string; name: string }[] };

  const orgName = (id: string) => orgs?.find((o) => o.id === id)?.name ?? id;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization membership. Document intake is under Ingestion.
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
