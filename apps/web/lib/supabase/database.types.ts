export type OpportunityOutcome = "WON" | "LOST" | "PENDING" | "CANCELLED" | "NO_BID";
export type OpportunityStage =
  | "INTAKE"
  | "ANALYSIS"
  | "PRICING"
  | "DRAFTING"
  | "SUBMITTED"
  | "AWARDED"
  | "CLOSED";
export type GoNoGo = "PENDING" | "GO" | "NO_GO";
export type ReuseStatus = "APPROVED" | "REVIEW" | "DO_NOT_USE" | "SUPERSEDED";

export type ContractAlertBucket = "180" | "120" | "90" | "60" | "30" | "EXPIRED";
export type ComplianceKind = "insurance" | "license" | "certification" | "other";

export type BatchMigrationStatus =
  | "OPEN"
  | "INGESTING"
  | "READY"
  | "PROCESSING"
  | "COMPLETE"
  | "PARTIAL"
  | "FAILED";

export type BatchItemOutcome = "INGESTED" | "DUPLICATE" | "FAILED";

export type CommercialTruth = "requested" | "proposed" | "awarded" | "current";

export type MembershipRole =
  | "admin"
  | "importer"
  | "verifier"
  | "bidder"
  | "executive";

export type DocumentProcessingStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PARSING"
  | "EXTRACTING"
  | "VALIDATING"
  | "NEEDS_REVIEW"
  | "VERIFIED"
  | "FAILED";

export type FactVerificationStatus =
  | "AI_EXTRACTED"
  | "NEEDS_REVIEW"
  | "HUMAN_VERIFIED"
  | "REJECTED"
  | "CONFLICT";

type Timestamped = {
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MembershipRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MembershipRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MembershipRole;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          title: string;
          stage: OpportunityStage;
          go_no_go: GoNoGo;
          response_due_on: string | null;
          service_type: string | null;
          notes: string | null;
          rebid_from_contract_id: string | null;
          rebid_from_opportunity_id: string | null;
          procurement_rail: string | null;
          solicitation_kind: string | null;
          site_location: string | null;
          submission_method: string | null;
          coverage_start_on: string | null;
          vehicle_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          title: string;
          stage?: OpportunityStage;
          go_no_go?: GoNoGo;
          response_due_on?: string | null;
          service_type?: string | null;
          notes?: string | null;
          rebid_from_contract_id?: string | null;
          rebid_from_opportunity_id?: string | null;
          procurement_rail?: string | null;
          solicitation_kind?: string | null;
          site_location?: string | null;
          submission_method?: string | null;
          coverage_start_on?: string | null;
          vehicle_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          title?: string;
          stage?: OpportunityStage;
          go_no_go?: GoNoGo;
          response_due_on?: string | null;
          service_type?: string | null;
          notes?: string | null;
          rebid_from_contract_id?: string | null;
          rebid_from_opportunity_id?: string | null;
          procurement_rail?: string | null;
          solicitation_kind?: string | null;
          site_location?: string | null;
          submission_method?: string | null;
          coverage_start_on?: string | null;
          vehicle_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staffing_requirements: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          post_label: string;
          armed: boolean | null;
          shift_hours: number | null;
          posts_count: number | null;
          weekly_hours: number | null;
          labor_category: string | null;
          clearance_note: string | null;
          source_fact_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          post_label: string;
          armed?: boolean | null;
          shift_hours?: number | null;
          posts_count?: number | null;
          weekly_hours?: number | null;
          labor_category?: string | null;
          clearance_note?: string | null;
          source_fact_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          post_label?: string;
          armed?: boolean | null;
          shift_hours?: number | null;
          posts_count?: number | null;
          weekly_hours?: number | null;
          labor_category?: string | null;
          clearance_note?: string | null;
          source_fact_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      evaluation_criteria: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          criterion: string;
          weight_pct: number | null;
          source_fact_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          criterion: string;
          weight_pct?: number | null;
          source_fact_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          criterion?: string;
          weight_pct?: number | null;
          source_fact_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pricing_cost_models: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          labor_category: string;
          base_wage: number | null;
          fringe: number | null;
          burden_pct: number | null;
          workers_comp: number | null;
          insurance: number | null;
          supervision: number | null;
          equipment: number | null;
          overhead_pct: number | null;
          target_margin_pct: number | null;
          planned_proposed_rate: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          labor_category: string;
          base_wage?: number | null;
          fringe?: number | null;
          burden_pct?: number | null;
          workers_comp?: number | null;
          insurance?: number | null;
          supervision?: number | null;
          equipment?: number | null;
          overhead_pct?: number | null;
          target_margin_pct?: number | null;
          planned_proposed_rate?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          labor_category?: string;
          base_wage?: number | null;
          fringe?: number | null;
          burden_pct?: number | null;
          workers_comp?: number | null;
          insurance?: number | null;
          supervision?: number | null;
          equipment?: number | null;
          overhead_pct?: number | null;
          target_margin_pct?: number | null;
          planned_proposed_rate?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_batches: {
        Row: {
          id: string;
          organization_id: string;
          label: string | null;
          created_by: string | null;
          created_at: string;
          status: BatchMigrationStatus;
          file_count: number;
          ingested_count: number;
          duplicate_count: number;
          failed_count: number;
          processed_count: number;
          api_cost_usd: number;
          compute_cost_usd: number;
          bytes_ingested: number;
          started_at: string | null;
          finished_at: string | null;
          last_error: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          label?: string | null;
          created_by?: string | null;
          created_at?: string;
          status?: BatchMigrationStatus;
          file_count?: number;
          ingested_count?: number;
          duplicate_count?: number;
          failed_count?: number;
          processed_count?: number;
          api_cost_usd?: number;
          compute_cost_usd?: number;
          bytes_ingested?: number;
          started_at?: string | null;
          finished_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          label?: string | null;
          created_by?: string | null;
          created_at?: string;
          status?: BatchMigrationStatus;
          file_count?: number;
          ingested_count?: number;
          duplicate_count?: number;
          failed_count?: number;
          processed_count?: number;
          api_cost_usd?: number;
          compute_cost_usd?: number;
          bytes_ingested?: number;
          started_at?: string | null;
          finished_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      batch_ingest_items: {
        Row: {
          id: string;
          organization_id: string;
          batch_id: string;
          filename: string;
          sha256: string | null;
          document_id: string | null;
          byte_size: number | null;
          outcome: BatchItemOutcome;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          batch_id: string;
          filename: string;
          sha256?: string | null;
          document_id?: string | null;
          byte_size?: number | null;
          outcome: BatchItemOutcome;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          batch_id?: string;
          filename?: string;
          sha256?: string | null;
          document_id?: string | null;
          byte_size?: number | null;
          outcome?: BatchItemOutcome;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          batch_id: string | null;
          client_id: string | null;
          opportunity_id: string | null;
          solicitation_id: string | null;
          original_filename: string;
          mime_type: string | null;
          document_type: string | null;
          commercial_truth: CommercialTruth | null;
          processing_status: DocumentProcessingStatus;
          workflow_run_id: string | null;
          lifecycle_error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          batch_id?: string | null;
          client_id?: string | null;
          opportunity_id?: string | null;
          solicitation_id?: string | null;
          original_filename: string;
          mime_type?: string | null;
          document_type?: string | null;
          commercial_truth?: CommercialTruth | null;
          processing_status?: DocumentProcessingStatus;
          workflow_run_id?: string | null;
          lifecycle_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          batch_id?: string | null;
          client_id?: string | null;
          opportunity_id?: string | null;
          solicitation_id?: string | null;
          original_filename?: string;
          mime_type?: string | null;
          document_type?: string | null;
          commercial_truth?: CommercialTruth | null;
          processing_status?: DocumentProcessingStatus;
          workflow_run_id?: string | null;
          lifecycle_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          version_number: number;
          sha256: string;
          storage_bucket: string;
          storage_path: string;
          source_drive_file_id: string | null;
          byte_size: number | null;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          version_number?: number;
          sha256: string;
          storage_bucket?: string;
          storage_path: string;
          source_drive_file_id?: string | null;
          byte_size?: number | null;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          document_id?: string;
          version_number?: number;
          sha256?: string;
          storage_bucket?: string;
          storage_path?: string;
          source_drive_file_id?: string | null;
          byte_size?: number | null;
          is_current?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      extraction_runs: {
        Row: {
          id: string;
          organization_id: string;
          document_version_id: string;
          parser_id: string | null;
          extractor_id: string | null;
          normalized_document: Record<string, unknown> | null;
          started_at: string;
          finished_at: string | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_version_id: string;
          parser_id?: string | null;
          extractor_id?: string | null;
          normalized_document?: Record<string, unknown> | null;
          started_at?: string;
          finished_at?: string | null;
          error?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          document_version_id?: string;
          parser_id?: string | null;
          extractor_id?: string | null;
          normalized_document?: Record<string, unknown> | null;
          started_at?: string;
          finished_at?: string | null;
          error?: string | null;
        };
        Relationships: [];
      };
      extracted_facts: {
        Row: {
          id: string;
          organization_id: string;
          extraction_run_id: string;
          document_id: string;
          document_version_id: string;
          idempotency_key: string;
          entity: string | null;
          field: string;
          raw_value: string | null;
          normalized_value: string | null;
          normalized_type: string | null;
          source_page: number | null;
          source_section: string | null;
          source_excerpt: string | null;
          confidence: number | null;
          verification_status: FactVerificationStatus;
          verified_value: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          extraction_run_id: string;
          document_id: string;
          document_version_id: string;
          idempotency_key?: string;
          entity?: string | null;
          field: string;
          raw_value?: string | null;
          normalized_value?: string | null;
          normalized_type?: string | null;
          source_page?: number | null;
          source_section?: string | null;
          source_excerpt?: string | null;
          confidence?: number | null;
          verification_status?: FactVerificationStatus;
          verified_value?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          extraction_run_id?: string;
          document_id?: string;
          document_version_id?: string;
          idempotency_key?: string;
          entity?: string | null;
          field?: string;
          raw_value?: string | null;
          normalized_value?: string | null;
          normalized_type?: string | null;
          source_page?: number | null;
          source_section?: string | null;
          source_excerpt?: string | null;
          confidence?: number | null;
          verification_status?: FactVerificationStatus;
          verified_value?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      source_evidence: {
        Row: Timestamped & {
          id: string;
          organization_id: string;
          extracted_fact_id: string;
          document_version_id: string;
          page: number | null;
          section: string | null;
          excerpt: string | null;
          bbox: unknown;
        };
        Insert: {
          id?: string;
          organization_id: string;
          extracted_fact_id: string;
          document_version_id: string;
          page?: number | null;
          section?: string | null;
          excerpt?: string | null;
          bbox?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          extracted_fact_id?: string;
          document_version_id?: string;
          page?: number | null;
          section?: string | null;
          excerpt?: string | null;
          bbox?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_events: {
        Row: Timestamped & {
          id: string;
          organization_id: string;
          extracted_fact_id: string | null;
          actor_id: string | null;
          action: string;
          from_status: FactVerificationStatus | null;
          to_status: FactVerificationStatus | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          extracted_fact_id?: string | null;
          actor_id?: string | null;
          action: string;
          from_status?: FactVerificationStatus | null;
          to_status?: FactVerificationStatus | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          extracted_fact_id?: string | null;
          actor_id?: string | null;
          action?: string;
          from_status?: FactVerificationStatus | null;
          to_status?: FactVerificationStatus | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      validation_exceptions: {
        Row: Timestamped & {
          id: string;
          organization_id: string;
          document_id: string | null;
          code: string;
          message: string;
          resolved: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id?: string | null;
          code: string;
          message: string;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          document_id?: string | null;
          code?: string;
          message?: string;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      solicitations: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          client_id: string | null;
          source_document_id: string | null;
          title: string;
          solicitation_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          client_id?: string | null;
          source_document_id?: string | null;
          title: string;
          solicitation_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          client_id?: string | null;
          source_document_id?: string | null;
          title?: string;
          solicitation_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      requirements: {
        Row: {
          id: string;
          organization_id: string;
          solicitation_id: string;
          source_fact_id: string | null;
          statement: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          solicitation_id: string;
          source_fact_id?: string | null;
          statement: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          solicitation_id?: string;
          source_fact_id?: string | null;
          statement?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_lines: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          labor_category: string;
          requested_rate: number | null;
          proposed_rate: number | null;
          awarded_rate: number | null;
          current_rate: number | null;
          requested_source_fact_id: string | null;
          proposed_source_fact_id: string | null;
          awarded_source_fact_id: string | null;
          current_source_fact_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          labor_category: string;
          requested_rate?: number | null;
          proposed_rate?: number | null;
          awarded_rate?: number | null;
          current_rate?: number | null;
          requested_source_fact_id?: string | null;
          proposed_source_fact_id?: string | null;
          awarded_source_fact_id?: string | null;
          current_source_fact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          labor_category?: string;
          requested_rate?: number | null;
          proposed_rate?: number | null;
          awarded_rate?: number | null;
          current_rate?: number | null;
          requested_source_fact_id?: string | null;
          proposed_source_fact_id?: string | null;
          awarded_source_fact_id?: string | null;
          current_source_fact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      awards: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          source_document_id: string | null;
          source_fact_id: string | null;
          notice: string | null;
          awarded_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          notice?: string | null;
          awarded_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          notice?: string | null;
          awarded_on?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string | null;
          client_id: string | null;
          source_document_id: string | null;
          source_fact_id: string | null;
          title: string;
          contract_number: string | null;
          start_on: string | null;
          verified_end_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id?: string | null;
          client_id?: string | null;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          title: string;
          contract_number?: string | null;
          start_on?: string | null;
          verified_end_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string | null;
          client_id?: string | null;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          title?: string;
          contract_number?: string | null;
          start_on?: string | null;
          verified_end_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_amendments: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string;
          source_document_id: string | null;
          source_fact_id: string | null;
          note: string;
          effective_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contract_id: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          note: string;
          effective_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contract_id?: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          note?: string;
          effective_on?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contract_options: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string;
          source_fact_id: string | null;
          label: string;
          exercise_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contract_id: string;
          source_fact_id?: string | null;
          label: string;
          exercise_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contract_id?: string;
          source_fact_id?: string | null;
          label?: string;
          exercise_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      renewals: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string;
          source_fact_id: string | null;
          notice: string | null;
          notice_due_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contract_id: string;
          source_fact_id?: string | null;
          notice?: string | null;
          notice_due_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contract_id?: string;
          source_fact_id?: string | null;
          notice?: string | null;
          notice_due_on?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      compliance_items: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string | null;
          source_fact_id: string | null;
          kind: ComplianceKind;
          statement: string;
          expires_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contract_id?: string | null;
          source_fact_id?: string | null;
          kind?: ComplianceKind;
          statement: string;
          expires_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contract_id?: string | null;
          source_fact_id?: string | null;
          kind?: ComplianceKind;
          statement?: string;
          expires_on?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contract_alerts: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string;
          bucket: ContractAlertBucket;
          days_until: number;
          verified_end_on: string;
          source_fact_id: string | null;
          computed_on: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contract_id: string;
          bucket: ContractAlertBucket;
          days_until: number;
          verified_end_on: string;
          source_fact_id?: string | null;
          computed_on?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contract_id?: string;
          bucket?: ContractAlertBucket;
          days_until?: number;
          verified_end_on?: string;
          source_fact_id?: string | null;
          computed_on?: string;
        };
        Relationships: [];
      };
      win_loss_reviews: {
        Row: {
          id: string;
          organization_id: string;
          opportunity_id: string;
          source_document_id: string | null;
          source_fact_id: string | null;
          outcome: OpportunityOutcome;
          documented_reason: string | null;
          internal_analysis: string | null;
          winner_name: string | null;
          lp_price: number | null;
          winning_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          opportunity_id: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          outcome: OpportunityOutcome;
          documented_reason?: string | null;
          internal_analysis?: string | null;
          winner_name?: string | null;
          lp_price?: number | null;
          winning_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          opportunity_id?: string;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          outcome?: OpportunityOutcome;
          documented_reason?: string | null;
          internal_analysis?: string | null;
          winner_name?: string | null;
          lp_price?: number | null;
          winning_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitor_bids: {
        Row: {
          id: string;
          organization_id: string;
          competitor_id: string;
          opportunity_id: string | null;
          source_document_id: string | null;
          source_fact_id: string | null;
          source_url: string | null;
          quoted_amount: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          competitor_id: string;
          opportunity_id?: string | null;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          source_url?: string | null;
          quoted_amount?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          competitor_id?: string;
          opportunity_id?: string | null;
          source_document_id?: string | null;
          source_fact_id?: string | null;
          source_url?: string | null;
          quoted_amount?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      research_facts: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          competitor_id: string | null;
          opportunity_id: string | null;
          source_document_id: string | null;
          source_url: string;
          title: string | null;
          excerpt: string | null;
          published_on: string | null;
          retrieved_at: string;
          verification_status: FactVerificationStatus;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          competitor_id?: string | null;
          opportunity_id?: string | null;
          source_document_id?: string | null;
          source_url: string;
          title?: string | null;
          excerpt?: string | null;
          published_on?: string | null;
          retrieved_at?: string;
          verification_status?: FactVerificationStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          competitor_id?: string | null;
          opportunity_id?: string | null;
          source_document_id?: string | null;
          source_url?: string;
          title?: string | null;
          excerpt?: string | null;
          published_on?: string | null;
          retrieved_at?: string;
          verification_status?: FactVerificationStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          document_version_id: string;
          source_fact_id: string | null;
          chunk_index: number;
          field: string | null;
          content: string;
          source_page: number | null;
          source_section: string | null;
          storage_bucket: string;
          storage_path: string;
          verification_status: FactVerificationStatus;
          reuse_status: ReuseStatus;
          is_current_version: boolean;
          embedding: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          document_version_id: string;
          source_fact_id?: string | null;
          chunk_index?: number;
          field?: string | null;
          content: string;
          source_page?: number | null;
          source_section?: string | null;
          storage_bucket?: string;
          storage_path: string;
          verification_status: FactVerificationStatus;
          reuse_status?: ReuseStatus;
          is_current_version?: boolean;
          embedding?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          document_id?: string;
          document_version_id?: string;
          source_fact_id?: string | null;
          chunk_index?: number;
          field?: string | null;
          content?: string;
          source_page?: number | null;
          source_section?: string | null;
          storage_bucket?: string;
          storage_path?: string;
          verification_status?: FactVerificationStatus;
          reuse_status?: ReuseStatus;
          is_current_version?: boolean;
          embedding?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      promote_knowledge_chunk_from_fact: {
        Args: { p_fact_id: string };
        Returns: Record<string, unknown>;
      };
      search_verified_knowledge: {
        Args: {
          p_query: string;
          p_query_embedding?: string | null;
          p_for_drafting?: boolean;
          p_limit?: number;
          p_opportunity_id?: string | null;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          document_version_id: string;
          source_fact_id: string | null;
          storage_bucket: string;
          storage_path: string;
          source_page: number | null;
          field: string | null;
          content: string;
          reuse_status: ReuseStatus;
          rank: number;
          match_kind: string;
        }[];
      };
      ensure_competitor: {
        Args: { p_organization_id: string; p_name: string };
        Returns: string;
      };
      parse_outcome: {
        Args: { raw: string };
        Returns: OpportunityOutcome | null;
      };
      promote_intelligence_from_fact: {
        Args: { p_fact_id: string };
        Returns: Record<string, unknown>;
      };
      promote_contract_from_fact: {
        Args: { p_fact_id: string };
        Returns: Record<string, unknown>;
      };
      refresh_contract_alerts: {
        Args: Record<string, never>;
        Returns: number;
      };
      alert_bucket_for_days: {
        Args: { days_until: number };
        Returns: ContractAlertBucket | null;
      };
      promote_verified_fact: {
        Args: { p_fact_id: string };
        Returns: Record<string, unknown>;
      };
      create_migration_batch: {
        Args: { p_organization_id: string; p_label: string };
        Returns: string;
      };
      record_batch_ingest_item: {
        Args: {
          p_organization_id: string;
          p_batch_id: string;
          p_filename: string;
          p_sha256: string | null;
          p_document_id: string | null;
          p_byte_size: number | null;
          p_outcome: BatchItemOutcome;
          p_error_message: string | null;
        };
        Returns: undefined;
      };
      finalize_batch_ingest: {
        Args: { p_organization_id: string; p_batch_id: string };
        Returns: BatchMigrationStatus;
      };
      mark_batch_processing: {
        Args: {
          p_organization_id: string;
          p_batch_id: string;
          p_document_count: number;
        };
        Returns: undefined;
      };
      record_batch_document_processed: {
        Args: {
          p_organization_id: string;
          p_batch_id: string;
          p_success: boolean;
          p_error?: string | null;
        };
        Returns: BatchMigrationStatus;
      };
      create_organization_with_admin: {
        Args: { org_name: string };
        Returns: string;
      };
      register_ingested_document: {
        Args: {
          p_organization_id: string;
          p_document_id: string;
          p_version_id: string;
          p_batch_id: string | null;
          p_batch_label: string | null;
          p_client_id: string | null;
          p_opportunity_id: string | null;
          p_original_filename: string;
          p_mime_type: string | null;
          p_sha256: string;
          p_storage_path: string;
          p_byte_size: number | null;
          p_source_drive_file_id: string | null;
        };
        Returns: {
          duplicate: boolean;
          document_id: string;
          document_version_id: string;
          storage_path: string;
          batch_id: string | null;
        };
      };
      storage_path_org_id: {
        Args: { object_name: string };
        Returns: string | null;
      };
      is_org_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { org_id: string };
        Returns: boolean;
      };
      has_org_role: {
        Args: { org_id: string; allowed: MembershipRole[] };
        Returns: boolean;
      };
      org_member_count: {
        Args: { org_id: string };
        Returns: number;
      };
    };
    Enums: {
      membership_role: MembershipRole;
      document_processing_status: DocumentProcessingStatus;
      fact_verification_status: FactVerificationStatus;
      commercial_truth: CommercialTruth;
      batch_migration_status: BatchMigrationStatus;
      batch_item_outcome: BatchItemOutcome;
      contract_alert_bucket: ContractAlertBucket;
      compliance_kind: ComplianceKind;
      opportunity_outcome: OpportunityOutcome;
      reuse_status: ReuseStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
