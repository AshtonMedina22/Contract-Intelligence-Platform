/**
 * Google Docs working-proposal provider (server-only).
 *
 * Credentials come from env — never from the browser:
 *   GOOGLE_DRIVE_ACCESS_TOKEN  (primary; Drive + Docs API bearer)
 *   GOOGLE_DOCS_ACCESS_TOKEN   (optional override)
 *
 * When no token is set, returns a clear blocker. Unit tests inject a stub adapter.
 */

export type GoogleDocsSyncMeta = {
  syncedAt: string;
  contentHash: string;
  idempotencyKey: string;
  provider: "google_docs";
  mode: "created" | "updated" | "reused";
};

export type CreateOrUpdateWorkingDocInput = {
  title: string;
  /** Plain text body (Docs API insertText). */
  content: string;
  idempotencyKey: string;
  existingDocId?: string | null;
  /** When true, always create a new document even if existingDocId / cache hit. */
  forceNew?: boolean;
};

export type CreateOrUpdateWorkingDocResult =
  | {
      ok: true;
      documentId: string;
      documentUrl: string;
      sync: GoogleDocsSyncMeta;
    }
  | {
      ok: false;
      code: "NOT_CONFIGURED" | "API_ERROR" | "INVALID_INPUT";
      message: string;
      blocker: true;
    };

export type GoogleDocsProvider = {
  isConfigured: () => boolean;
  createOrUpdateWorkingDoc: (
    input: CreateOrUpdateWorkingDocInput,
  ) => Promise<CreateOrUpdateWorkingDocResult>;
};

type IdempotencyStore = Map<string, { documentId: string; documentUrl: string; contentHash: string }>;

function docsUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

function simpleHash(content: string): string {
  // Lightweight fingerprint for sync metadata (not a security boundary).
  let h = 0;
  for (let i = 0; i < content.length; i += 1) h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

/** Stub / in-memory adapter for unit tests and local runs without Google creds. */
export function createStubGoogleDocsProvider(options?: {
  configured?: boolean;
  store?: IdempotencyStore;
}): GoogleDocsProvider {
  const configured = options?.configured ?? false;
  const store = options?.store ?? new Map();
  let seq = 0;

  return {
    isConfigured: () => configured,
    async createOrUpdateWorkingDoc(input) {
      if (!configured) {
        return {
          ok: false,
          code: "NOT_CONFIGURED",
          blocker: true,
          message:
            "Google Docs is not configured. Set GOOGLE_DRIVE_ACCESS_TOKEN (or GOOGLE_DOCS_ACCESS_TOKEN) on the server. Nothing was created or synced.",
        };
      }
      if (!input.title?.trim()) {
        return { ok: false, code: "INVALID_INPUT", blocker: true, message: "Document title is required." };
      }
      const contentHash = simpleHash(input.content ?? "");
      const key = input.idempotencyKey?.trim();
      if (!input.forceNew && key && store.has(key)) {
        const hit = store.get(key)!;
        return {
          ok: true,
          documentId: hit.documentId,
          documentUrl: hit.documentUrl,
          sync: {
            syncedAt: new Date().toISOString(),
            contentHash,
            idempotencyKey: key,
            provider: "google_docs",
            mode: hit.contentHash === contentHash ? "reused" : "updated",
          },
        };
      }
      if (!input.forceNew && input.existingDocId?.trim()) {
        const id = input.existingDocId.trim();
        const url = docsUrl(id);
        if (key) store.set(key, { documentId: id, documentUrl: url, contentHash });
        return {
          ok: true,
          documentId: id,
          documentUrl: url,
          sync: {
            syncedAt: new Date().toISOString(),
            contentHash,
            idempotencyKey: key || id,
            provider: "google_docs",
            mode: "updated",
          },
        };
      }
      seq += 1;
      const documentId = `stub-doc-${seq}-${Date.now().toString(36)}`;
      const documentUrl = docsUrl(documentId);
      if (key) store.set(key, { documentId, documentUrl, contentHash });
      return {
        ok: true,
        documentId,
        documentUrl,
        sync: {
          syncedAt: new Date().toISOString(),
          contentHash,
          idempotencyKey: key || documentId,
          provider: "google_docs",
          mode: "created",
        },
      };
    },
  };
}

type FetchLike = typeof fetch;

/**
 * Live Google Docs + Drive adapter.
 * Creates a Google Doc via Drive files.create (mime google-apps.document),
 * then replaces body text via Docs batchUpdate.
 */
export function createLiveGoogleDocsProvider(accessToken: string, fetchImpl: FetchLike = fetch): GoogleDocsProvider {
  const token = accessToken.trim();
  const memory: IdempotencyStore = new Map();

  async function createDocument(title: string): Promise<{ id: string }> {
    const res = await fetchImpl("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
      }),
    });
    if (!res.ok) {
      throw new Error(`Drive create failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Drive create returned no file id.");
    return { id: json.id };
  }

  async function replaceBody(documentId: string, content: string): Promise<void> {
    // End-of-segment index is unknown without a get; clear by deleting a large range then insert.
    const getRes = await fetchImpl(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}?fields=body(content)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!getRes.ok) {
      throw new Error(`Docs get failed (${getRes.status}): ${(await getRes.text()).slice(0, 400)}`);
    }
    const doc = (await getRes.json()) as {
      body?: { content?: { endIndex?: number }[] };
    };
    const endIndexes = (doc.body?.content ?? [])
      .map((c) => c.endIndex)
      .filter((n): n is number => typeof n === "number");
    const endIndex = endIndexes.length ? Math.max(...endIndexes) : 1;
    const requests: object[] = [];
    if (endIndex > 1) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 },
        },
      });
    }
    if (content) {
      requests.push({
        insertText: {
          location: { index: 1 },
          text: content,
        },
      });
    }
    if (requests.length === 0) return;
    const updateRes = await fetchImpl(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      },
    );
    if (!updateRes.ok) {
      throw new Error(`Docs batchUpdate failed (${updateRes.status}): ${(await updateRes.text()).slice(0, 400)}`);
    }
  }

  return {
    isConfigured: () => Boolean(token),
    async createOrUpdateWorkingDoc(input) {
      if (!token) {
        return {
          ok: false,
          code: "NOT_CONFIGURED",
          blocker: true,
          message:
            "Google Docs is not configured. Set GOOGLE_DRIVE_ACCESS_TOKEN (or GOOGLE_DOCS_ACCESS_TOKEN) on the server.",
        };
      }
      if (!input.title?.trim()) {
        return { ok: false, code: "INVALID_INPUT", blocker: true, message: "Document title is required." };
      }
      const contentHash = simpleHash(input.content ?? "");
      const key = input.idempotencyKey?.trim();

      try {
        if (!input.forceNew && key && memory.has(key)) {
          const hit = memory.get(key)!;
          await replaceBody(hit.documentId, input.content ?? "");
          return {
            ok: true,
            documentId: hit.documentId,
            documentUrl: hit.documentUrl,
            sync: {
              syncedAt: new Date().toISOString(),
              contentHash,
              idempotencyKey: key,
              provider: "google_docs",
              mode: "updated",
            },
          };
        }

        let documentId = !input.forceNew ? input.existingDocId?.trim() || "" : "";
        let mode: GoogleDocsSyncMeta["mode"] = "updated";
        if (!documentId) {
          const created = await createDocument(input.title.trim());
          documentId = created.id;
          mode = "created";
        }
        await replaceBody(documentId, input.content ?? "");
        const documentUrl = docsUrl(documentId);
        if (key) memory.set(key, { documentId, documentUrl, contentHash });
        return {
          ok: true,
          documentId,
          documentUrl,
          sync: {
            syncedAt: new Date().toISOString(),
            contentHash,
            idempotencyKey: key || documentId,
            provider: "google_docs",
            mode,
          },
        };
      } catch (err) {
        return {
          ok: false,
          code: "API_ERROR",
          blocker: true,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export function resolveGoogleDocsAccessToken(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const docs = env.GOOGLE_DOCS_ACCESS_TOKEN?.trim();
  if (docs) return docs;
  const drive = env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  return drive || null;
}

/** Server factory: live when token present, otherwise unconfigured stub. */
export function getGoogleDocsProvider(env: NodeJS.ProcessEnv = process.env): GoogleDocsProvider {
  const token = resolveGoogleDocsAccessToken(env);
  if (!token) return createStubGoogleDocsProvider({ configured: false });
  return createLiveGoogleDocsProvider(token);
}
