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

export type JobPort = {
  startDocumentLifecycle(
    input: StartDocumentLifecycleInput,
  ): Promise<StartDocumentLifecycleResult>;
};
