import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OpportunityDocumentsPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, original_filename, document_type, commercial_truth, processing_status, created_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Evidence documents</h2>
          <p className="text-xs text-muted-foreground">
            Immutable vault copies. Tag commercial truth on intake (requested / proposed / awarded / current).
          </p>
        </div>
        <Link
          className="text-sm underline"
          href={`/ingestion/intake?opportunity=${opportunityId}`}
        >
          Upload more
        </Link>
      </div>

      {(documents ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents linked to this pursuit yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">File</th>
                <th className="p-2">Type</th>
                <th className="p-2">Commercial truth</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(documents ?? []).map((doc) => (
                <tr key={doc.id} className="border-b">
                  <td className="p-2">
                    <Link className="underline" href={`/ingestion/verification/${doc.id}`}>
                      {doc.original_filename}
                    </Link>
                  </td>
                  <td className="p-2 text-muted-foreground">{doc.document_type ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{doc.commercial_truth ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{doc.processing_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
