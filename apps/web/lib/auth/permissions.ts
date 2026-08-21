import type { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/supabase/database.types";
import {
  APPROVAL_LAYER_ROLES,
  INTAKE_ROLES,
  PRICING_APPROVE_ROLES,
  requireOrgRole,
  VERIFY_ROLES,
} from "@/lib/org/roles";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** F10 permission keys — map to existing membership roles (no viewer role). */
export type Permission =
  | "intake.write"
  | "verify.promote"
  | "research.verify"
  | "pricing.edit"
  | "pricing.approve"
  | "proposal.approve"
  | "pursuit.submit"
  | "result.write"
  | "contract.create"
  | "rebid.clone"
  | "org.admin"
  | "ask.use";

const ALL_MEMBER_ROLES: readonly MembershipRole[] = [
  "admin",
  "importer",
  "verifier",
  "bidder",
  "executive",
];

/** Permission → allowed roles. Keep INTAKE/VERIFY/PRICING_APPROVE sets aligned. */
export const PERMISSION_ROLES: Record<Permission, readonly MembershipRole[]> = {
  "intake.write": INTAKE_ROLES,
  "verify.promote": VERIFY_ROLES,
  "research.verify": VERIFY_ROLES,
  "pricing.edit": PRICING_APPROVE_ROLES,
  "pricing.approve": PRICING_APPROVE_ROLES,
  "proposal.approve": APPROVAL_LAYER_ROLES,
  "pursuit.submit": APPROVAL_LAYER_ROLES,
  "result.write": APPROVAL_LAYER_ROLES,
  "contract.create": APPROVAL_LAYER_ROLES,
  "rebid.clone": APPROVAL_LAYER_ROLES,
  "org.admin": ["admin"],
  "ask.use": ALL_MEMBER_ROLES,
};

export function rolesForPermission(permission: Permission): readonly MembershipRole[] {
  return PERMISSION_ROLES[permission];
}

export function memberHasPermission(
  role: MembershipRole | string | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return PERMISSION_ROLES[permission].includes(role as MembershipRole);
}

export type OrgCapabilities = {
  role: MembershipRole;
  canIntakeWrite: boolean;
  canVerifyPromote: boolean;
  canResearchVerify: boolean;
  canPricingEdit: boolean;
  canPricingApprove: boolean;
  canProposalApprove: boolean;
  canPursuitSubmit: boolean;
  canResultWrite: boolean;
  canContractCreate: boolean;
  canRebidClone: boolean;
  canOrgAdmin: boolean;
  canAskUse: boolean;
};

export function capabilitiesForRole(role: MembershipRole): OrgCapabilities {
  return {
    role,
    canIntakeWrite: memberHasPermission(role, "intake.write"),
    canVerifyPromote: memberHasPermission(role, "verify.promote"),
    canResearchVerify: memberHasPermission(role, "research.verify"),
    canPricingEdit: memberHasPermission(role, "pricing.edit"),
    canPricingApprove: memberHasPermission(role, "pricing.approve"),
    canProposalApprove: memberHasPermission(role, "proposal.approve"),
    canPursuitSubmit: memberHasPermission(role, "pursuit.submit"),
    canResultWrite: memberHasPermission(role, "result.write"),
    canContractCreate: memberHasPermission(role, "contract.create"),
    canRebidClone: memberHasPermission(role, "rebid.clone"),
    canOrgAdmin: memberHasPermission(role, "org.admin"),
    canAskUse: memberHasPermission(role, "ask.use"),
  };
}

/**
 * Server-side gate: resolve membership role and assert it is allowed for `permission`.
 * Wraps `requireOrgRole` — same error shape for unauthorized callers.
 */
export async function requirePermission(
  supabase: Supabase,
  userId: string,
  orgId: string,
  permission: Permission,
): Promise<MembershipRole> {
  return requireOrgRole(supabase, userId, orgId, PERMISSION_ROLES[permission]);
}
