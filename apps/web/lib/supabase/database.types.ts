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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          title?: string;
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
        };
        Insert: {
          id?: string;
          organization_id: string;
          label?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          label?: string | null;
          created_by?: string | null;
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
          original_filename: string;
          mime_type: string | null;
          document_type: string | null;
          processing_status: DocumentProcessingStatus;
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
          original_filename: string;
          mime_type?: string | null;
          document_type?: string | null;
          processing_status?: DocumentProcessingStatus;
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
          original_filename?: string;
          mime_type?: string | null;
          document_type?: string | null;
          processing_status?: DocumentProcessingStatus;
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
    };
    Views: Record<string, never>;
    Functions: {
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
    };
    CompositeTypes: Record<string, never>;
  };
};
