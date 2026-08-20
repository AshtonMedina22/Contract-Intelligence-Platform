"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveValidationException } from "@/app/(platform)/ingestion/verification/actions";

export type ExceptionRow = {
  id: string;
  code: string;
  message: string;
  document_id: string | null;
  resolved: boolean;
  created_at: string;
};

export function ExceptionsTable({ rows }: { rows: ExceptionRow[] }) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No exceptions recorded.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2 font-mono text-xs">code</th>
            <th className="p-2 font-mono text-xs">message</th>
            <th className="p-2 font-mono text-xs">document</th>
            <th className="p-2 font-mono text-xs">resolved</th>
            <th className="p-2 font-mono text-xs">created_at</th>
            <th className="p-2 font-mono text-xs">action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="p-2">{row.code}</td>
              <td className="p-2">{row.message}</td>
              <td className="p-2">
                {row.document_id ? (
                  <Link className="underline" href={`/ingestion/verification/${row.document_id}`}>
                    {row.document_id.slice(0, 8)}…
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="p-2">
                <Badge variant="outline">{row.resolved ? "yes" : "open"}</Badge>
              </td>
              <td className="p-2 font-mono text-xs">{row.created_at}</td>
              <td className="p-2">
                {row.resolved ? (
                  "—"
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await resolveValidationException({
                          exceptionId: row.id,
                          note: "Resolved from Exceptions queue",
                        });
                      })
                    }
                  >
                    Resolve
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
