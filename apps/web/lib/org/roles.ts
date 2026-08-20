import type { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/supabase/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Data Ops intake / bulk migration. */
export const INTAKE_ROLES: readonly MembershipRole[] = ["admin", "importer", "verifier"];

/** Human verification and promote. */
export const VERIFY_ROLES: readonly MembershipRole[] = ["admin", "verifier"];

/** Human-approved final bid. */
export const PRICING_APPROVE_ROLES: readonly MembershipRole[] = ["admin", "bidder", "executive"];

/** Configure / record pursuit approval layers. */
export const APPROVAL_LAYER_ROLES: readonly MembershipRole[] = ["admin", "executive", "bidder"];

export async function requireOrgRole(
  supabase: Supabase,
  userId: string,
  organizationId: string,
  allowed: readonly MembershipRole[],
): Promise<MembershipRole> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of that organization.");

  const role = data.role as MembershipRole;
  if (!allowed.includes(role)) {
    throw new Error(`Requires role ${allowed.join("|")}; your role is ${role}.`);
  }
  return role;
}
