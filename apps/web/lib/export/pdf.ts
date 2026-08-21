/**
 * PDF export — honest limitation document.
 *
 * This platform does not ship a server-side HTML→PDF converter (no Puppeteer,
 * Playwright, wkhtmltopdf, or cloud PDF API in the web deploy path). Claiming
 * a downloadable `.pdf` by renaming HTML would be dishonest.
 *
 * Supported path today: download the assembled HTML and use the browser print
 * dialog (Print → Save as PDF). That is the only PDF path offered in UI.
 */

export const PDF_EXPORT_STATUS = {
  available: false as const,
  reason:
    "No reliable server-side PDF converter is configured. Use Download HTML → browser Print → Save as PDF. The app does not emit PDF bytes.",
  recommendedPath: "HTML_PRINT" as const,
  fakePdfForbidden: true as const,
};

export type PdfExportResult =
  | { ok: false; code: "NO_CONVERTER"; message: string }
  | { ok: true; bytes: Uint8Array; mime: "application/pdf" };

/**
 * Always refuses until a real converter is wired. Never returns HTML renamed
 * as PDF.
 */
export function exportProposalPdf(_html?: string): PdfExportResult {
  void _html;
  return {
    ok: false,
    code: "NO_CONVERTER",
    message: PDF_EXPORT_STATUS.reason,
  };
}

export function describePdfLimitation(): string {
  return PDF_EXPORT_STATUS.reason;
}
