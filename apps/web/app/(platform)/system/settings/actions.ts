"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MembershipRole } from "@/lib/supabase/database.types";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/permissions";

function fail(message: string): never {
  redirect(`/system/settings?error=${encodeURIComponent(message)}`);
}

const ALLOWED_ROLES: readonly MembershipRole[] = [
  "admin",
  "importer",
  "verifier",
  "bidder",
  "executive",
];

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    fail("Organization name is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    fail("You must be signed in.");
  }

  const { error } = await supabase.rpc("create_organization_with_admin", {
    org_name: name,
  });

  if (error) {
    fail(error.message);
  }

  revalidatePath("/system/settings");
  redirect("/system/settings");
}

/**
 * Change a member's role in an organization. Requires org.admin.
 * Does not invent a viewer role — only the five stored membership roles.
 */
export async function updateMembershipRole(formData: FormData) {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const targetUserId = String(formData.get("user_id") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  if (!organizationId || !targetUserId) fail("Organization and member are required.");
  if (!ALLOWED_ROLES.includes(roleRaw as MembershipRole)) {
    fail(`Role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
  }
  const role = roleRaw as MembershipRole;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) fail("You must be signed in.");

  try {
    await requirePermission(supabase, user.id, organizationId, "org.admin");
  } catch (e) {
    fail(e instanceof Error ? e.message : "Requires org admin.");
  }

  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId);

  if (error) fail(error.message);

  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: user.id,
    action: "org.admin",
    entityType: "membership",
    entityId: targetUserId,
    metadata: { role },
  });

  revalidatePath("/system/settings");
  redirect("/system/settings");
}
