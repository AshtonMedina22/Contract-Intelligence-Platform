import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { DataOpsNav } from "@/components/section-tabs";

async function VerificationQueueContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <p className="text-sm">Sign in to open the verification queue.</p>;
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, original_filename, processing_status, mime_type, updated_at")
    .in("processing_status", ["NEEDS_REVIEW", "VERIFIED", "VALIDATING", "EXTRACTING"])
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const ids = (documents ?? []).map((doc) => doc.id);
  const { data: facts } =
    ids.length > 0
      ? await supabase.from("extracted_facts").select("document_id, verification_status").in("document_id", ids)
      : { data: [] as { document_id: string; verification_status: string }[] };

  const openByDoc = new Map<string, number>();
  for (const fact of facts ?? []) {
    if (["AI_EXTRACTED", "NEEDS_REVIEW", "CONFLICT"].includes(fact.verification_status)) {
      openByDoc.set(fact.document_id, (openByDoc.get(fact.document_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-3">
      <DataOpsNav />
      <div className="space-y-0.5">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">Verification queue</h1>
        <p className="text-sm text-muted-foreground">
          Human review against source. AI-extracted values are not canonical until verified.
        </p>
      </div>
      {(documents ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">No documents waiting. Run intake + processor first.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(documents ?? []).map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Link className="font-medium underline" href={`/ingestion/verification/${doc.id}`}>
                  {doc.original_filename}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {openByDoc.get(doc.id) ?? 0} open facts
                </div>
              </div>
              <Badge variant="outline">{doc.processing_status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VerificationQueuePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <VerificationQueueContent />
    </Suspense>
  );
}
