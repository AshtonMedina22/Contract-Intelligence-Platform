/**
 * Document type → commercial truth → promote RPCs → canonical tables.
 * Single source of truth for Settings → Data model and docs/DOCUMENT_TABLE_MAPPING.md.
 *
 * Class C (competitor test corpus) may fill intelligence tables but must never
 * write L&P four-truth history as if it were L&P-authored.
 */

export type CommercialTruth = "requested" | "proposed" | "awarded" | "current";

export type CorpusClass = "A" | "B" | "C";

/** DB enum values for procurement_packages.corpus_class */
export const CORPUS_CLASS_DB: Record<CorpusClass, "A_LP_ORIGINATED" | "B_LP_TIED" | "C_COMPETITOR_TEST"> = {
  A: "A_LP_ORIGINATED",
  B: "B_LP_TIED",
  C: "C_COMPETITOR_TEST",
};

export type PromoteRpc =
  | "promote_verified_fact"
  | "promote_contract_from_fact"
  | "promote_intelligence_from_fact"
  | "promote_knowledge_chunk_from_fact";

export type FillStatus = "live" | "partial" | "schema_ready" | "deferred";

export type DocumentTypeMapEntry = {
  /** Intake / documents.document_type values (normalized lowercase). */
  documentTypes: string[];
  /** Filename tokens that also select this row (infer_commercial_truth / DOC_META). */
  filenameHints: string[];
  commercialTruth: CommercialTruth;
  corpusClasses: CorpusClass[];
  /** Product surface that consumes the promoted rows. */
  productSurface: string;
  /** Promote RPCs that must run after HUMAN_VERIFIED (order matters). */
  promoteRpcs: PromoteRpc[];
  /** Tables that should receive rows for this document kind. */
  targetTables: string[];
  /** Staging fact fields the extractor should emit when evidence exists. */
  expectedFields: string[];
  status: FillStatus;
  notes: string;
};

/** Pilot PKG keys → expected corpus class (manifest). */
export const PILOT_PACKAGE_MAP: Record<
  string,
  { title: string; buyer: string; corpusClass: CorpusClass; srcIds: string[] }
> = {
  "PKG-01": {
    title: "Williamson County Lake Creek Annex #202569",
    buyer: "Williamson County",
    corpusClass: "A",
    srcIds: ["SRC-01"],
  },
  "PKG-02": {
    title: "Allen ISD security agreement",
    buyer: "Allen ISD",
    corpusClass: "A",
    srcIds: ["SRC-02", "SRC-03"],
  },
  "PKG-03": {
    title: "Arlington TX 22-0143",
    buyer: "Arlington TX",
    corpusClass: "B",
    srcIds: ["SRC-06", "SRC-07"],
  },
  "PKG-04": {
    title: "TxDMV PO 0000016167",
    buyer: "TxDMV",
    corpusClass: "A",
    srcIds: ["SRC-04"],
  },
  "PKG-05": {
    title: "Jefferson County bid tab",
    buyer: "Jefferson County",
    corpusClass: "B",
    srcIds: ["SRC-08"],
  },
  "PKG-06": {
    title: "Texas Lottery IFB RQ22-0480DP",
    buyer: "Texas Lottery",
    corpusClass: "B",
    srcIds: ["SRC-09"],
  },
  "PKG-07": {
    title: "Dallas County BID TAB 16-0219",
    buyer: "Dallas County",
    corpusClass: "C",
    srcIds: ["SRC-10"],
  },
  "PKG-08": {
    title: "Dallas County 2014-036 synopsis",
    buyer: "Dallas County",
    corpusClass: "C",
    srcIds: ["SRC-11"],
  },
  "PKG-09": {
    title: "Tarrant County 2018-092",
    buyer: "Tarrant County",
    corpusClass: "C",
    srcIds: ["SRC-12"],
  },
  "PKG-10": {
    title: "MHMR Tarrant 25-003 tabulation",
    buyer: "MHMR Tarrant",
    corpusClass: "C",
    srcIds: ["SRC-13"],
  },
  "PKG-11": {
    title: "Harris County CPI renewal VSA",
    buyer: "Harris County",
    corpusClass: "C",
    srcIds: ["SRC-14"],
  },
  "PKG-12": {
    title: "TFC VSA 24-001 + Amend 4",
    buyer: "TFC",
    corpusClass: "C",
    srcIds: ["SRC-15", "SRC-16"],
  },
  "PKG-13": {
    title: "Arlington County VA 19-264-R",
    buyer: "Arlington County VA",
    corpusClass: "C",
    srcIds: ["SRC-17", "SRC-18", "SRC-19"],
  },
};

export const DOCUMENT_TABLE_MAP: DocumentTypeMapEntry[] = [
  {
    documentTypes: ["rfp", "rfq", "ifb", "solicitation", "rfp solicitation", "ifb solicitation"],
    filenameHints: ["rfp", "rfq", "ifb", "invitation", "solicitation"],
    commercialTruth: "requested",
    corpusClasses: ["B", "C"],
    productSurface: "Pursuit → Requirements / Pricing (requested)",
    promoteRpcs: ["promote_verified_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["solicitations", "requirements", "required_forms", "pricing_lines", "document_chunks"],
    expectedFields: ["solicitation_number", "requirement", "requested_rate", "required_form"],
    status: "partial",
    notes: "required_forms table exists; extractor rarely emits form rows yet.",
  },
  {
    documentTypes: ["addendum", "q&a", "clarification"],
    filenameHints: ["addendum", "addenda", "q&a", "clarification"],
    commercialTruth: "requested",
    corpusClasses: ["B"],
    productSurface: "Pursuit → Requirements (precedence over base solicitation)",
    promoteRpcs: ["promote_verified_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["solicitation_addenda", "solicitation_q_and_a", "requirements", "pricing_lines", "solicitation_change_runs", "solicitation_change_items"],
    expectedFields: ["solicitation_number", "requirement", "requested_rate", "addendum_number", "q_and_a"],
    status: "partial",
    notes: "F11: addenda + Q&A + change-impact runs. Detected changes AI_EXTRACTED until verify.promote; apply never sets HUMAN_APPROVED.",
  },
  {
    documentTypes: ["proposal", "proposal draft", "final proposal", "quote", "contract+proposal"],
    filenameHints: ["proposal", "quote"],
    commercialTruth: "proposed",
    corpusClasses: ["A"],
    productSurface: "Pursuit → Pricing / Response; Intelligence → Content",
    promoteRpcs: [
      "promote_verified_fact",
      "promote_contract_from_fact",
      "promote_knowledge_chunk_from_fact",
    ],
    targetTables: ["pricing_lines", "proposal_sections", "document_chunks", "federal_identifiers"],
    expectedFields: ["proposed_rate", "proposal_section", "txmas", "gsa"],
    status: "partial",
    notes: "Rates promote; proposal_sections need section-grain facts.",
  },
  {
    documentTypes: ["award", "award notice", "award staff report", "board packet"],
    filenameHints: ["award", "staff-report", "staff report", "board"],
    commercialTruth: "awarded",
    corpusClasses: ["A", "B"],
    productSurface: "Pursuit → Result; Intelligence → Win/Loss / Competitors",
    promoteRpcs: [
      "promote_verified_fact",
      "promote_intelligence_from_fact",
      "promote_knowledge_chunk_from_fact",
    ],
    targetTables: ["awards", "evaluation_scores", "pricing_lines", "win_loss_reviews"],
    expectedFields: ["award", "awarded_rate", "evaluation_score", "winner_name", "outcome"],
    status: "partial",
    notes: "awards + rates live; evaluation_scores still empty without score facts.",
  },
  {
    documentTypes: ["bid tab", "tabulation"],
    filenameHints: ["bid tab", "tabulation", "tab"],
    commercialTruth: "awarded",
    corpusClasses: ["B", "C"],
    productSurface: "Intelligence → Competitors / Pricing (comps)",
    promoteRpcs: [
      "promote_verified_fact",
      "promote_intelligence_from_fact",
      "promote_knowledge_chunk_from_fact",
    ],
    targetTables: ["pricing_lines", "competitor_pricing_lines", "competitor_bids", "competitors"],
    expectedFields: ["awarded_rate", "competitor_price", "competitor_name", "lp_price"],
    status: "partial",
    notes: "L&P-near rates → pricing_lines; other vendors → competitor_pricing_lines.",
  },
  {
    documentTypes: ["purchase order", "po"],
    filenameHints: ["purchase", " po ", "0000016167"],
    commercialTruth: "awarded",
    corpusClasses: ["A"],
    productSurface: "Contracts → Commercial Terms",
    promoteRpcs: [
      "promote_verified_fact",
      "promote_contract_from_fact",
      "promote_knowledge_chunk_from_fact",
    ],
    targetTables: ["purchase_orders", "purchase_order_lines", "pricing_lines", "federal_identifiers"],
    expectedFields: ["po_number", "awarded_rate", "payment_terms", "txmas", "gsa"],
    status: "partial",
    notes: "promote_contract_from_fact writes POs when po_number facts exist.",
  },
  {
    documentTypes: ["contract", "agreement", "agreement excerpt", "contract+noa"],
    filenameHints: ["contract", "agreement"],
    commercialTruth: "awarded",
    corpusClasses: ["A", "C"],
    productSurface: "Contracts workspace (Overview / Service Plan / Commercial)",
    promoteRpcs: [
      "promote_verified_fact",
      "promote_contract_from_fact",
      "promote_knowledge_chunk_from_fact",
    ],
    targetTables: [
      "contracts",
      "contract_service_plans",
      "federal_identifiers",
      "compliance_items",
      "pricing_lines",
    ],
    expectedFields: [
      "contract_number",
      "contract_title",
      "contract_start",
      "contract_end",
      "site_name",
      "guard_classification",
      "awarded_rate",
    ],
    status: "partial",
    notes: "Class C contracts verify for schema coverage; do not label as L&P history. F12: compliance_items carry verification_status, coverage_json, holder_name; org SAM/UEI/CAGE live on organization_registrations (mirrored to kind=registration for F9).",
  },
  {
    documentTypes: ["coi", "certificate of insurance", "insurance certificate"],
    filenameHints: ["coi", "insurance", "certificate of insurance"],
    commercialTruth: "awarded",
    corpusClasses: ["A"],
    productSurface: "Contracts → Compliance",
    promoteRpcs: ["promote_contract_from_fact"],
    targetTables: ["compliance_items"],
    expectedFields: ["insurance_expiration", "coverage limits (opaque coverage_json)"],
    status: "schema_ready",
    notes: "F12: never invent limits; HUMAN_VERIFIED via verify.promote only; VERIFIED_AVAILABLE requires source.",
  },
  {
    documentTypes: ["license", "certification", "sam registration", "uei cage"],
    filenameHints: ["license", "certification", "sam", "uei", "cage"],
    commercialTruth: "awarded",
    corpusClasses: ["A"],
    productSurface: "Contracts → Compliance",
    promoteRpcs: [],
    targetTables: ["compliance_items", "organization_registrations", "requirement_compliance_matches"],
    expectedFields: ["uei", "cage", "sam_expiration", "naics", "license_expiration"],
    status: "schema_ready",
    notes: "F12 eligibility matches are advisory; AI cannot set HUMAN_VERIFIED or VERIFIED_AVAILABLE.",
  },
  {
    documentTypes: ["amendment", "modification", "amendment scan"],
    filenameHints: ["amend", "modification"],
    commercialTruth: "current",
    corpusClasses: ["C", "A"],
    productSurface: "Contracts → Changes",
    promoteRpcs: ["promote_contract_from_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["contract_amendments", "pricing_lines", "contracts"],
    expectedFields: ["amendment_number", "amendment_title", "current_rate"],
    status: "partial",
    notes: "Needs amendment_* facts + awarded/current truth.",
  },
  {
    documentTypes: ["renewal", "option exercise"],
    filenameHints: ["renewal", "option"],
    commercialTruth: "current",
    corpusClasses: ["C", "A"],
    productSurface: "Contracts → Renewal",
    promoteRpcs: ["promote_contract_from_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["renewals", "contract_options", "pricing_lines"],
    expectedFields: ["renewal_notice", "escalation_index", "option_exercise_by", "current_rate"],
    status: "schema_ready",
    notes: "Harris CPI renewal in corpus; structured escalation facts still thin.",
  },
  {
    documentTypes: ["cost build", "pricing workbook"],
    filenameHints: ["cost build", "workbook", "xlsx"],
    commercialTruth: "awarded",
    corpusClasses: ["C"],
    productSurface: "Intelligence → Pricing (comps) / Pursuit cost model",
    promoteRpcs: ["promote_intelligence_from_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["cost_build_components", "competitor_pricing_lines"],
    expectedFields: ["cost_component", "competitor_price"],
    status: "schema_ready",
    notes: "cost_build_components table live; no XLSX USABLE yet.",
  },
  {
    documentTypes: ["evaluator scorecard", "synopsis"],
    filenameHints: ["scorecard", "synopsis", "eval"],
    commercialTruth: "awarded",
    corpusClasses: ["B", "C"],
    productSurface: "Intelligence → Win/Loss / Competitors",
    promoteRpcs: ["promote_intelligence_from_fact", "promote_knowledge_chunk_from_fact"],
    targetTables: ["evaluation_scores", "evaluation_criteria", "win_loss_reviews"],
    expectedFields: ["evaluation_score", "evaluation_criterion", "documented_reason"],
    status: "schema_ready",
    notes: "Score tables exist; extractor must emit numeric score facts.",
  },
];

export const PROMOTE_CHAIN: PromoteRpc[] = [
  "promote_verified_fact",
  "promote_contract_from_fact",
  "promote_intelligence_from_fact",
  "promote_knowledge_chunk_from_fact",
];

export function mapEntryForDocument(documentType: string | null | undefined, filename?: string | null) {
  const blob = `${documentType ?? ""} ${filename ?? ""}`.toLowerCase();
  return (
    DOCUMENT_TABLE_MAP.find(
      (row) =>
        row.documentTypes.some((t) => blob.includes(t.toLowerCase())) ||
        row.filenameHints.some((h) => blob.includes(h.toLowerCase())),
    ) ?? null
  );
}

export function packageKeyForSrc(srcId: string): string | null {
  for (const [pkg, meta] of Object.entries(PILOT_PACKAGE_MAP)) {
    if (meta.srcIds.includes(srcId)) return pkg;
  }
  return null;
}
