/**
 * Google Docs working-proposal helpers (server-only re-exports + idempotency key).
 * Prefer importing `getGoogleDocsProvider` from docs-provider in actions.
 */

export {
  getGoogleDocsProvider,
  createStubGoogleDocsProvider,
  createLiveGoogleDocsProvider,
  resolveGoogleDocsAccessToken,
  type CreateOrUpdateWorkingDocInput,
  type CreateOrUpdateWorkingDocResult,
  type GoogleDocsProvider,
  type GoogleDocsSyncMeta,
} from "./docs-provider";

/** Stable idempotency key for a pursuit + content hash (repeat export → same doc). */
export function workingDocIdempotencyKey(input: {
  organizationId: string;
  opportunityId: string;
  contentHash: string;
  forceNew?: boolean;
}): string {
  if (input.forceNew) {
    return `force:${input.organizationId}:${input.opportunityId}:${input.contentHash}:${Date.now()}`;
  }
  return `wd:${input.organizationId}:${input.opportunityId}:${input.contentHash}`;
}
