import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AuditLogInput = {
  organizationId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Append an org-scoped audit row. Call after consequential RBAC-gated mutations succeed.
 * Uses the caller's Supabase session so RLS WITH CHECK (same org member) applies.
 */
export async function writeAuditLog(supabase: Supabase, input: AuditLogInput): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`audit_log write failed: ${error.message}`);
}
