export type StartDocumentLifecycleInput = {
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  sha256: string;
};

export type StartDocumentLifecycleResult = {
  runId: string;
  adapter: "vercel-workflow" | "inline";
};

export type EmbedFanOutInput = {
  organizationId: string;
  sourceFactId: string;
};

/**
 * Canonical boundary: Vercel Workflow owns document lifecycle
 * (intake → parse → extract → validate → wait for human → promote).
 * Vercel Queues must not start or advance that lifecycle.
 * Independent fan-out (embeddings) is allowed here and must not
 * skip human verification or write canonical facts.
 */
export type JobPort = {
  startDocumentLifecycle(
    input: StartDocumentLifecycleInput,
  ): Promise<StartDocumentLifecycleResult>;
  /** Optional: enqueue embedding after a fact is HUMAN_VERIFIED + chunked. */
  enqueueEmbedFanOut?(input: EmbedFanOutInput): Promise<void>;
};
