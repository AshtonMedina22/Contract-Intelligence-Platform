import { z } from "zod";

/** Keep in sync with services/processor Pydantic models. */

export const cellValueSchema = z.object({
  sheet: z.string(),
  coordinate: z.string(),
  row: z.number().int().positive(),
  column: z.number().int().positive(),
  data_type: z.string(),
  number_format: z.string().nullable(),
  formula: z.string().nullable(),
  cached_value: z.string().nullable(),
  display_value: z.string().nullable(),
  merged_range: z.string().nullable(),
});

export const sheetSchema = z.object({
  name: z.string(),
  index: z.number().int().nonnegative(),
  max_row: z.number().int().nonnegative(),
  max_column: z.number().int().nonnegative(),
  merged_ranges: z.array(z.string()),
  cells: z.array(cellValueSchema),
});

export const pdfPageSchema = z.object({
  page: z.number().int().positive(),
  text: z.string(),
});

export const normalizedDocumentSchema = z.object({
  parser_id: z.string(),
  mime_type: z.string().nullable(),
  filename: z.string().nullable(),
  page_count: z.number().int().nonnegative().nullable(),
  sheet_count: z.number().int().nonnegative().nullable(),
  sheets: z.array(sheetSchema).default([]),
  pages: z.array(pdfPageSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export const extractedFactDraftSchema = z.object({
  idempotency_key: z.string().min(1),
  entity: z.string().nullable(),
  field: z.string().min(1),
  raw_value: z.string().nullable(),
  normalized_value: z.string().nullable(),
  normalized_type: z.string().nullable(),
  source_page: z.number().int().positive().nullable(),
  source_section: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const processorJobRequestSchema = z.object({
  organization_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_version_id: z.string().uuid(),
  extraction_run_id: z.string().uuid().optional(),
});

export type CellValue = z.infer<typeof cellValueSchema>;
export type SheetStructure = z.infer<typeof sheetSchema>;
export type PdfPage = z.infer<typeof pdfPageSchema>;
export type NormalizedDocument = z.infer<typeof normalizedDocumentSchema>;
export type ExtractedFactDraft = z.infer<typeof extractedFactDraftSchema>;
export type ProcessorJobRequest = z.infer<typeof processorJobRequestSchema>;
