export type DataLayer = "staging" | "canonical" | "derived" | "intelligence" | "system";

export type TableRegistryEntry = {
  table: string;
  layer: DataLayer;
  purpose: string;
  keyColumns: string[];
  liveRoute: string;
  fedBy: string[];
  feeds: string[];
};

export const LAYER_LABELS: Record<DataLayer, string> = {
  staging: "Staging",
  canonical: "Canonical",
  derived: "Derived / search",
  intelligence: "Intelligence",
  system: "System",
};

export const RFQ_FLOW_STEPS = [
  {
    step: 1,
    label: "Upload evidence",
    table: "documents",
    route: "/ingestion/intake",
    output: "Immutable file in Storage + document_versions.sha256",
  },
  {
    step: 2,
    label: "AI extract (staging only)",
    table: "extracted_facts",
    route: "/ingestion/processing",
    output: "NEEDS_REVIEW facts — not trusted yet",
  },
  {
    step: 3,
    label: "Human verify",
    table: "extracted_facts",
    route: "/ingestion/verification",
    output: "HUMAN_VERIFIED facts trigger promote_verified_fact RPC",
  },
  {
    step: 4,
    label: "Canonical promotion",
    table: "pricing_lines · requirements · awards",
    route: "/procurement/opportunities",
    output: "Four commercial truths on the opportunity package",
  },
  {
    step: 5,
    label: "Searchable knowledge",
    table: "document_chunks",
    route: "/intelligence/ask",
    output: "Ask Intelligence cites verified chunks for the next RFQ",
  },
  {
    step: 6,
    label: "Outcome → contract",
    table: "win_loss_reviews · contracts",
    route: "/intelligence/win-loss",
    output: "Documented reasons + current contract truth for rebid",
  },
] as const;

export const TABLE_REGISTRY: TableRegistryEntry[] = [
  {
    table: "documents",
    layer: "staging",
    purpose: "Evidence registry — every uploaded file",
    keyColumns: ["original_filename", "document_type", "commercial_truth", "processing_status", "opportunity_id"],
    liveRoute: "/procurement/documents",
    fedBy: ["Intake upload", "Bulk migration"],
    feeds: ["extracted_facts", "document_versions", "opportunity package links"],
  },
  {
    table: "document_versions",
    layer: "staging",
    purpose: "Immutable vault versions (SHA-256, storage path)",
    keyColumns: ["sha256", "storage_path", "is_current", "source_drive_file_id"],
    liveRoute: "/procurement/documents",
    fedBy: ["register_ingested_document RPC"],
    feeds: ["extraction_runs", "signed PDF in verification workbench"],
  },
  {
    table: "extracted_facts",
    layer: "staging",
    purpose: "AI + human field values before promotion",
    keyColumns: ["field", "entity", "normalized_value", "verified_value", "verification_status", "source_page"],
    liveRoute: "/ingestion/verification",
    fedBy: ["Processor (store.py)"],
    feeds: ["pricing_lines", "requirements", "document_chunks", "win_loss_reviews"],
  },
  {
    table: "validation_exceptions",
    layer: "staging",
    purpose: "Promotion conflicts — rate/truth overwrite refused",
    keyColumns: ["code", "message", "document_id", "resolved"],
    liveRoute: "/ingestion/exceptions",
    fedBy: ["promote_verified_fact RPC on conflict"],
    feeds: ["Human resolution → re-verify source fact"],
  },
  {
    table: "opportunities",
    layer: "canonical",
    purpose: "L&P package / pursuit hub",
    keyColumns: ["title", "client_id"],
    liveRoute: "/procurement/opportunities",
    fedBy: ["Intake form", "Identity promotion from verified facts"],
    feeds: ["pricing_lines", "solicitations", "awards", "documents.opportunity_id"],
  },
  {
    table: "clients",
    layer: "canonical",
    purpose: "Buyer / agency (not CRM)",
    keyColumns: ["name"],
    liveRoute: "/procurement/clients",
    fedBy: ["Intake", "Identity promotion"],
    feeds: ["opportunities", "contracts", "research_facts filter"],
  },
  {
    table: "pricing_lines",
    layer: "canonical",
    purpose: "Four commercial truths — separate rate columns",
    keyColumns: [
      "labor_category",
      "requested_rate",
      "proposed_rate",
      "awarded_rate",
      "current_rate",
      "*_source_fact_id",
    ],
    liveRoute: "/intelligence/pricing",
    fedBy: ["promote_verified_fact from verified pricing facts"],
    feeds: ["Opportunity package", "Pricing intelligence (Phase 12)", "Ask (via chunks)"],
  },
  {
    table: "requirements",
    layer: "canonical",
    purpose: "Canonical requirement statements from requested sources",
    keyColumns: ["statement", "solicitation_id", "source_fact_id"],
    liveRoute: "/procurement/requirements",
    fedBy: ["promote_verified_fact (requested docs only)"],
    feeds: ["Opportunity package", "Future proposal workspace"],
  },
  {
    table: "awards",
    layer: "canonical",
    purpose: "Award notice promoted from verified facts",
    keyColumns: ["notice", "awarded_on", "source_fact_id"],
    liveRoute: "/procurement/opportunities",
    fedBy: ["promote_verified_fact"],
    feeds: ["Opportunity package", "Contract promotion"],
  },
  {
    table: "contracts",
    layer: "canonical",
    purpose: "Current contract truth after award",
    keyColumns: ["title", "contract_number", "verified_end_on", "source_fact_id"],
    liveRoute: "/contracts",
    fedBy: ["promote_contract_from_fact"],
    feeds: ["contract_alerts", "renewals", "compliance_items"],
  },
  {
    table: "document_chunks",
    layer: "derived",
    purpose: "Verified text for FTS + vector search",
    keyColumns: ["content", "source_fact_id", "reuse_status", "is_current_version", "embedding"],
    liveRoute: "/intelligence/content",
    fedBy: ["promote_knowledge_chunk_from_fact + embedVerifiedChunk"],
    feeds: ["search_verified_knowledge → Ask Intelligence"],
  },
  {
    table: "win_loss_reviews",
    layer: "intelligence",
    purpose: "Documented evaluator reason vs internal analysis",
    keyColumns: ["outcome", "documented_reason", "internal_analysis", "lp_price", "winning_price"],
    liveRoute: "/intelligence/win-loss",
    fedBy: ["promote_intelligence_from_fact"],
    feeds: ["Market counts", "Reports", "Rebid context"],
  },
  {
    table: "competitor_bids",
    layer: "intelligence",
    purpose: "Sourced competitor pricing evidence",
    keyColumns: ["quoted_amount", "source_url", "source_fact_id", "competitor_id"],
    liveRoute: "/intelligence/competitors",
    fedBy: ["promote_intelligence_from_fact"],
    feeds: ["Market overview", "Pricing comparisons"],
  },
  {
    table: "research_facts",
    layer: "intelligence",
    purpose: "Public-source buyer/competitor research",
    keyColumns: ["source_url", "excerpt", "verification_status", "client_id"],
    liveRoute: "/intelligence/clients",
    fedBy: ["Manual / promoted research"],
    feeds: ["Buyer intelligence briefs"],
  },
];

export function tablesForLayer(layer: DataLayer) {
  return TABLE_REGISTRY.filter((entry) => entry.layer === layer);
}

export function registryEntry(table: string) {
  return TABLE_REGISTRY.find((entry) => entry.table === table);
}
