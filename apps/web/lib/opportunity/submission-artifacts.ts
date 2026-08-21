/**
 * Submission artifact versioning helpers (pure — no Supabase).
 */

export type ArtifactApprovalState = "WORKING" | "READY" | "SUBMITTED" | "SUPERSEDED";

export type SubmissionArtifactRow = {
  id: string;
  organization_id: string;
  opportunity_id: string;
  packet_id: string | null;
  version: number;
  generated_at: string;
  generator: string;
  approval_state: ArtifactApprovalState;
  content_hash: string;
  sources: unknown;
  google_doc_id: string | null;
  google_doc_url: string | null;
  google_sync: unknown;
  docx_storage_path: string | null;
  portal_json: unknown;
  html_snapshot: string | null;
  immutable: boolean;
};

export function nextArtifactVersion(existingVersions: number[]): number {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions) + 1;
}

export function canMutateArtifact(row: Pick<SubmissionArtifactRow, "immutable" | "approval_state">): {
  allowed: boolean;
  reason: string | null;
} {
  if (row.immutable || row.approval_state === "SUBMITTED") {
    return {
      allowed: false,
      reason:
        "This artifact is immutable (submitted snapshot). Generate a new version for further edits.",
    };
  }
  return { allowed: true, reason: null };
}

export function assertSameTenant(
  rowOrgId: string,
  callerOrgId: string,
): { ok: true } | { ok: false; reason: string } {
  if (rowOrgId !== callerOrgId) {
    return { ok: false, reason: "Tenant separation: artifact organization_id does not match caller." };
  }
  return { ok: true };
}
