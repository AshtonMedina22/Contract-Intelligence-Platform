import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export type OrgOption = {
  id: string;
  name: string;
  role: string;
};

export type NamedOption = {
  id: string;
  name: string;
};

export type OpportunityOption = {
  id: string;
  title: string;
  client_id: string | null;
};

export async function getIntakeContext() {
  if (!hasEnvVars) {
    return {
      user: null,
      organizations: [] as OrgOption[],
      clients: [] as NamedOption[],
      opportunities: [] as OpportunityOption[],
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        user: null,
        organizations: [] as OrgOption[],
        clients: [] as NamedOption[],
        opportunities: [] as OpportunityOption[],
      };
    }

    const { data: memberships } = await supabase
      .from("memberships")
      .select("role, organization_id")
      .eq("user_id", user.id);

    const orgIds = (memberships ?? []).map((row) => row.organization_id);
    const { data: orgs } =
      orgIds.length > 0
        ? await supabase.from("organizations").select("id, name").in("id", orgIds)
        : { data: [] as { id: string; name: string }[] };

    const organizations: OrgOption[] = (memberships ?? []).map((row) => ({
      id: row.organization_id,
      name: orgs?.find((org) => org.id === row.organization_id)?.name ?? row.organization_id,
      role: row.role,
    }));

    const { data: clients } =
      orgIds.length > 0
        ? await supabase.from("clients").select("id, name").in("organization_id", orgIds).order("name")
        : { data: [] as NamedOption[] };

    const { data: opportunities } =
      orgIds.length > 0
        ? await supabase
            .from("opportunities")
            .select("id, title, client_id")
            .in("organization_id", orgIds)
            .order("title")
        : { data: [] as OpportunityOption[] };

    return {
      user,
      organizations,
      clients: clients ?? [],
      opportunities: opportunities ?? [],
    };
  } catch {
    return {
      user: null,
      organizations: [] as OrgOption[],
      clients: [] as NamedOption[],
      opportunities: [] as OpportunityOption[],
    };
  }
}
