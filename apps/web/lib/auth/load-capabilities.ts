import { createClient } from "@/lib/supabase/server";
import {
  capabilitiesForRole,
  type OrgCapabilities,
} from "@/lib/auth/permissions";
import type { MembershipRole } from "@/lib/supabase/database.types";

/** Load the signed-in user's org role capabilities (first membership). */
export async function loadCurrentOrgCapabilities(): Promise<OrgCapabilities | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.role) return null;
  return capabilitiesForRole(membership.role as MembershipRole);
}
