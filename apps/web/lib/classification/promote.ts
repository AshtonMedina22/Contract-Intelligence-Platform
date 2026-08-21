import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DataClassification } from "./types";

export type SetDocumentClassificationResult = {
  ok: boolean;
  action?: string;
  document_id?: string;
  from?: DataClassification;
  to?: DataClassification;
};

/**
 * The database RPC re-reads tenant ownership and enforces verifier/admin authority.
 * Callers must never update documents.data_classification directly.
 */
export async function setDocumentDataClassification(
  supabase: SupabaseClient<Database>,
  input: {
    documentId: string;
    dataClassification: DataClassification;
    reason: string;
  },
): Promise<SetDocumentClassificationResult> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Classification reason is required.");

  const { data, error } = await supabase.rpc("set_document_data_classification", {
    p_document_id: input.documentId,
    p_data_classification: input.dataClassification,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return (data ?? { ok: false }) as SetDocumentClassificationResult;
}
