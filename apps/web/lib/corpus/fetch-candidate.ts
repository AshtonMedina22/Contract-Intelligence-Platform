/**
 * Download a public URL, magic-check bytes, SHA-256, write under downloads dir.
 * Never bypasses auth/CAPTCHA/paywalls — marks MANUAL_IMPORT / LINK_ONLY / FAILED honestly.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchCandidateResult } from "./types";

const PDF_MAGIC = Buffer.from("%PDF");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b]); // PK — docx/xlsx
const MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 90_000;

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type MagicKind = "pdf" | "docx_or_xlsx" | "html" | "json" | "unknown";

export function detectMagic(bytes: Uint8Array): MagicKind {
  if (bytes.byteLength >= 4) {
    const head = Buffer.from(bytes.subarray(0, 5));
    if (head.subarray(0, 4).equals(PDF_MAGIC)) return "pdf";
    if (head.subarray(0, 2).equals(ZIP_MAGIC)) return "docx_or_xlsx";
  }
  const sample = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 512))).toString("utf8");
  if (/^\s*</.test(sample) && /html|DOCTYPE/i.test(sample)) return "html";
  if (/^\s*[\{\[]/.test(sample)) return "json";
  return "unknown";
}

function filenameFromUrl(url: string, magic: MagicKind, contentType: string | null): string {
  try {
    const u = new URL(url);
    const base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "download");
    const cleaned = base.replace(/[^\w.\-()+% ]+/g, "_").slice(0, 180);
    if (/\.(pdf|docx?|xlsx?|xls)$/i.test(cleaned)) return cleaned;
    if (magic === "pdf" || contentType?.includes("pdf")) return `${cleaned || "document"}.pdf`;
    if (magic === "docx_or_xlsx") {
      if (contentType?.includes("sheet") || /\.xlsx?/i.test(url)) return `${cleaned || "workbook"}.xlsx`;
      return `${cleaned || "document"}.docx`;
    }
    return cleaned || "download.bin";
  } catch {
    return "download.bin";
  }
}

export type FetchCandidateOptions = {
  url: string;
  downloadDir: string;
  /** Optional stable filename prefix (e.g. seed id). */
  filePrefix?: string;
  timeoutMs?: number;
  /** When true, skip binary download for known HTML portal URLs. */
  preferLinkOnly?: boolean;
};

/**
 * Fetch URL. HTML portals → LINK_ONLY (no fake PDF). Auth walls → MANUAL_IMPORT.
 * Binary PDF/DOCX/XLSX → ACQUIRED with sha256 + local path.
 */
export async function fetchCandidate(opts: FetchCandidateOptions): Promise<FetchCandidateResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = opts.url.trim();

  if (opts.preferLinkOnly) {
    return {
      ok: true,
      status: "LINK_ONLY",
      bytes: null,
      sha256: null,
      contentType: "text/html",
      byteSize: null,
      localPath: null,
      filename: null,
      note: "Portal/bookmark URL — operator opens primary source; no binary fabricated.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "ContractIntelligencePlatform/F23 (+https://github.com/AshtonMedina22/Contract-Intelligence-Platform; public-corpus-acquisition)",
        accept: "application/pdf,application/vnd.openxmlformats-officedocument.*,application/octet-stream,*/*",
      },
    });

    const contentType = res.headers.get("content-type");

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: "MANUAL_IMPORT",
        error: `HTTP ${res.status} — auth/paywall; not bypassed. Manual import required.`,
        contentType,
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        status: "FAILED",
        error: `HTTP 404 — URL not found.`,
        contentType,
      };
    }

    if (res.status === 429) {
      return {
        ok: false,
        status: "FAILED",
        error: `HTTP 429 — rate limited; retry later. No CAPTCHA bypass attempted.`,
        contentType,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: "FAILED",
        error: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
        contentType,
      };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) {
      return { ok: false, status: "FAILED", error: "Empty response body.", contentType };
    }
    if (buf.byteLength > MAX_BYTES) {
      return {
        ok: false,
        status: "FAILED",
        error: `Body exceeds ${MAX_BYTES} byte intake limit.`,
        contentType,
      };
    }

    const magic = detectMagic(buf);

    if (magic === "html") {
      return {
        ok: true,
        status: "LINK_ONLY",
        bytes: null,
        sha256: null,
        contentType: contentType ?? "text/html",
        byteSize: buf.byteLength,
        localPath: null,
        filename: null,
        note: "HTML page returned — recorded LINK_ONLY; not treated as PDF evidence.",
      };
    }

    if (magic === "json") {
      // Structured API JSON can be saved as REFERENCE_DATA sidecar, not vault PDF.
      mkdirSync(opts.downloadDir, { recursive: true });
      const sha = sha256Hex(buf);
      const name = `${opts.filePrefix ? `${opts.filePrefix}_` : ""}${sha.slice(0, 12)}.json`;
      const localPath = join(opts.downloadDir, name);
      writeFileSync(localPath, buf);
      return {
        ok: true,
        status: "ACQUIRED",
        bytes: buf,
        sha256: sha,
        contentType: contentType ?? "application/json",
        byteSize: buf.byteLength,
        localPath,
        filename: name,
        note: "JSON reference payload saved locally — not F1 PDF/DOCX/XLSX vault ingest.",
      };
    }

    if (magic !== "pdf" && magic !== "docx_or_xlsx") {
      // Unknown binary — keep if content-type suggests document, else LINK/FAIL honestly.
      if (
        contentType &&
        (contentType.includes("pdf") ||
          contentType.includes("officedocument") ||
          contentType.includes("msword") ||
          contentType.includes("excel"))
      ) {
        // fall through
      } else {
        return {
          ok: false,
          status: "REJECTED",
          error: `Unrecognized content (magic=${magic}, type=${contentType ?? "unknown"}).`,
          contentType,
        };
      }
    }

    const sha = sha256Hex(buf);
    const filename = `${opts.filePrefix ? `${opts.filePrefix}_` : ""}${filenameFromUrl(url, magic, contentType)}`;
    mkdirSync(opts.downloadDir, { recursive: true });
    const localPath = join(opts.downloadDir, filename);
    writeFileSync(localPath, buf);

    return {
      ok: true,
      status: "ACQUIRED",
      bytes: buf,
      sha256: sha,
      contentType,
      byteSize: buf.byteLength,
      localPath,
      filename,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(msg)) {
      return { ok: false, status: "FAILED", error: `Timeout after ${timeoutMs}ms.` };
    }
    return { ok: false, status: "FAILED", error: msg.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

/** True when acquire path must never set HUMAN_VERIFIED (always). */
export function acquirePathAllowsHumanVerified(): false {
  return false;
}
