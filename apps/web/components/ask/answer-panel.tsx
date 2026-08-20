import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeHit } from "@/lib/retrieval/search";
import type { LocateRecord } from "@/lib/retrieval/search";

export function AskAnswerPanel(props: {
  answer: string;
  insufficient: boolean;
  dataScope: string;
  limitations: string;
  purpose: string;
  mode: string;
  sources?: KnowledgeHit[];
  locate?: LocateRecord[];
  modelUsed?: string | null;
}) {
  return (
    <section className="max-w-3xl space-y-4 border p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">mode={props.mode}</Badge>
        <Badge variant="outline">purpose={props.purpose}</Badge>
        {props.modelUsed ? <Badge variant="outline">model={props.modelUsed}</Badge> : null}
      </div>

      <div className="space-y-1">
        <h2 className="font-medium">Answer</h2>
        <p className={props.insufficient ? "text-muted-foreground" : ""}>{props.answer}</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Sources / Evidence</h2>
        {props.sources && props.sources.length > 0 ? (
          <ul className="space-y-2">
            {props.sources.map((s) => (
              <li key={s.chunk_id} className="border-t pt-2">
                <p className="line-clamp-3 whitespace-pre-wrap">{s.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.reuse_status} · page {s.source_page ?? "—"} · {s.match_kind}
                </p>
                <Link className="text-xs underline" href={`/ingestion/verification/${s.document_id}`}>
                  View Source
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No verified passages in scope for this query.</p>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="font-medium">Data Scope</h2>
        <p className="text-muted-foreground">{props.dataScope}</p>
      </div>

      <div className="space-y-1">
        <h2 className="font-medium">Limitations / confidence</h2>
        <p className="text-muted-foreground">{props.limitations}</p>
      </div>

      <div className="space-y-1">
        <h2 className="font-medium">View Source</h2>
        {props.sources && props.sources.length > 0 ? (
          <ul className="space-y-1">
            {props.sources.map((s) => (
              <li key={`vs-${s.chunk_id}`}>
                <Link className="underline" href={`/ingestion/verification/${s.document_id}`}>
                  Open verification workbench ({s.field || "passage"})
                </Link>
              </li>
            ))}
          </ul>
        ) : props.locate && props.locate.length > 0 ? (
          <ul className="space-y-1">
            {props.locate.map((r) => (
              <li key={`vs-${r.kind}-${r.id}`}>
                <Link className="underline" href={r.href}>
                  Open {r.kind}: {r.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No source document available until verified evidence is found.</p>
        )}
      </div>

      {props.locate && props.locate.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-medium">Direct records (LOCATE)</h2>
          <ul className="space-y-1">
            {props.locate.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Badge variant="outline" className="mr-2">
                  {r.kind}
                </Badge>
                <Link className="underline" href={r.href}>
                  {r.title}
                </Link>
                {r.detail ? <span className="text-muted-foreground"> — {r.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
