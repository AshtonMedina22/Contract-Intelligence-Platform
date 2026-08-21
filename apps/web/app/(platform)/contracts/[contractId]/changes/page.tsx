import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadContractChanges } from "@/lib/contracts/load-workspace";
import {
  buildChangeTimeline,
  CHANGE_HISTORY_APPEND_ONLY_NOTE,
  CHANGE_TIMELINE_KINDS,
  CHANGE_TIMELINE_KIND_LABELS,
} from "@/lib/contracts/portfolio-model";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractChangesPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, opportunity_id, start_on, source_fact_id, source_document_id")
    .eq("id", contractId)
    .maybeSingle();

  const { amendments, options, renewals, award } = await loadContractChanges(
    contractId,
    contract?.opportunity_id ?? null,
  );

  const timeline = buildChangeTimeline({
    contract: contract
      ? {
          start_on: contract.start_on,
          source_fact_id: contract.source_fact_id,
          source_document_id: contract.source_document_id,
        }
      : null,
    award,
    amendments,
    options,
    renewalNotices: renewals,
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">
            Change timeline ({CHANGE_TIMELINE_KINDS.map((k) => CHANGE_TIMELINE_KIND_LABELS[k]).join(" → ")})
          </h2>
          <p className="text-sm text-muted-foreground">{CHANGE_HISTORY_APPEND_ONLY_NOTE}</p>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No instrument on file for this contract — not even an original award record.
          </p>
        ) : (
          <ol className="space-y-3 text-sm" data-testid="change-timeline">
            {timeline.map((entry) => (
              <li key={entry.key} data-kind={entry.kind} className="border-l-2 pl-3">
                <p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {CHANGE_TIMELINE_KIND_LABELS[entry.kind]}
                  </span>{" "}
                  <span className="font-medium">{entry.label}</span>{" "}
                  {entry.undated ? (
                    <span className="text-muted-foreground" title="No date recorded on this instrument">
                      · undated
                    </span>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">· {entry.on}</span>
                  )}
                </p>
                {entry.detail ? <p className="text-muted-foreground">{entry.detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {entry.sources.length === 0
                    ? "No source recorded for this entry."
                    : entry.sources.map((source, index) => (
                        <span key={source.label}>
                          {index > 0 ? " · " : ""}
                          {source.href ? (
                            <Link className="underline" href={source.href}>
                              {source.label}
                            </Link>
                          ) : (
                            source.label
                          )}
                        </span>
                      ))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Amendments / modifications / change orders</h2>
          <p className="text-sm text-muted-foreground">
            The recorded rows behind the timeline above. Historical rows are never overwritten by later
            promotions, and no amendment carries an amount in this schema.
          </p>
        </div>
        {amendments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Effective</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {amendments.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{dash(row.amendment_number)}</td>
                    <td className="py-2 pr-3">{dash(row.title)}</td>
                    <td className="py-2 pr-3">{dash(row.effective_on)}</td>
                    <td className="py-2 pr-3">{dash(row.note)}</td>
                    <td className="py-2">
                      {row.source_document_id ? (
                        <Link className="underline" href={`/ingestion/verification/${row.source_document_id}`}>
                          document {row.source_document_id.slice(0, 8)}
                        </Link>
                      ) : row.source_fact_id ? (
                        <span className="text-muted-foreground">fact {row.source_fact_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-muted-foreground" title="Not recorded: source_fact_id">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Option exercises (on file)</h2>
          <p className="text-sm text-muted-foreground">
            Listed from verified option rows only — exercised vs remaining is not assumed.
          </p>
        </div>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {options.map((row) => (
              <li key={row.id}>
                {row.label}
                {row.exercise_by ? ` · exercise by ${row.exercise_by}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
