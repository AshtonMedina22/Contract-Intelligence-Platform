import type { DataClassification, ClassificationPurpose } from "./types";
import { isClassificationEligible } from "./eligibility";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ClassificationQueryClient = SupabaseClient<Database>;

export function collectSourceFactIds(
  rows: readonly Record<string, unknown>[],
  fields: readonly string[],
): string[] {
  return [
    ...new Set(
      rows.flatMap((row) =>
        fields
          .map((field) => row[field])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    ),
  ];
}

export async function loadSourceFactClassifications(
  supabase: ClassificationQueryClient,
  factIds: readonly string[],
): Promise<Map<string, DataClassification>> {
  if (!factIds.length) return new Map();
  const result = new Map<string, DataClassification>();
  for (let offset = 0; offset < factIds.length; offset += 200) {
    const batch = factIds.slice(offset, offset + 200);
    const { data, error } = await supabase
      .from("extracted_facts")
      .select("id, data_classification")
      .in("id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) result.set(row.id, row.data_classification);
  }
  return result;
}

export async function loadDocumentClassifications(
  supabase: ClassificationQueryClient,
  documentIds: readonly string[],
): Promise<Map<string, DataClassification>> {
  if (!documentIds.length) return new Map();
  const result = new Map<string, DataClassification>();
  for (let offset = 0; offset < documentIds.length; offset += 200) {
    const batch = documentIds.slice(offset, offset + 200);
    const { data, error } = await supabase
      .from("documents")
      .select("id, data_classification")
      .in("id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) result.set(row.id, row.data_classification);
  }
  return result;
}

export function filterRowsBySourceClassification<T extends Record<string, unknown>>(
  rows: readonly T[],
  options: {
    fields: readonly string[];
    classifications: ReadonlyMap<string, DataClassification>;
    purpose: ClassificationPurpose;
    /** Canonical trusted surfaces fail closed; operational analytics may retain unsourced rows. */
    includeWhenUnclassified?: boolean;
  },
): T[] {
  return rows.filter((row) => {
    const ids = options.fields
      .map((field) => row[field])
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (!ids.length) return options.includeWhenUnclassified === true;
    // A structured row can carry several independently sourced values (for
    // example the four pricing truths). Deny the entire row when any cited
    // source is ineligible so a trusted field cannot smuggle demo data from a
    // sibling field into Ask, reports, or drafting.
    return ids.every((id) => {
      const classification = options.classifications.get(id);
      return classification ? isClassificationEligible(classification, options.purpose) : false;
    });
  });
}
