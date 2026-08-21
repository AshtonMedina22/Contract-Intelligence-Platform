"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { resolveValidationException } from "@/app/(platform)/ingestion/verification/actions";

export type ExceptionRow = {
  id: string;
  code: string;
  message: string;
  document_id: string | null;
  document_filename: string | null;
  processing_status: string | null;
  resolved: boolean;
  created_at: string;
};

type FilterState = "open" | "resolved" | "all";

function getExceptionType(code: string): "no_facts" | "precedence_conflict" | "other" {
  if (code === "no_facts") return "no_facts";
  if (code.includes("conflict") || code.includes("precedence") || code.includes("overwrite")) {
    return "precedence_conflict";
  }
  return "other";
}

function ExceptionTypeBadge({ code }: { code: string }) {
  const type = getExceptionType(code);
  if (type === "no_facts") {
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">No Facts</Badge>;
  }
  if (type === "precedence_conflict") {
    return <Badge variant="outline" className="bg-red-100 text-red-700">Precedence Conflict</Badge>;
  }
  return <Badge variant="outline">{code}</Badge>;
}

export function ExceptionsTable({ rows }: { rows: ExceptionRow[] }) {
  const [pending, startTransition] = useTransition();
  const [filterState, setFilterState] = useState<FilterState>("open");
  const [resolveDialogId, setResolveDialogId] = useState<string | null>(null);
  const [dispositionNote, setDispositionNote] = useState("");

  const filteredRows = useMemo(() => {
    if (filterState === "all") return rows;
    if (filterState === "open") return rows.filter((r) => !r.resolved);
    return rows.filter((r) => r.resolved);
  }, [rows, filterState]);

  const counts = useMemo(() => ({
    open: rows.filter((r) => !r.resolved).length,
    resolved: rows.filter((r) => r.resolved).length,
    all: rows.length,
  }), [rows]);

  const resolveRow = rows.find((r) => r.id === resolveDialogId);

  function handleResolve() {
    if (!resolveDialogId || !dispositionNote.trim()) return;
    startTransition(async () => {
      await resolveValidationException({
        exceptionId: resolveDialogId,
        note: dispositionNote.trim(),
      });
      setResolveDialogId(null);
      setDispositionNote("");
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No exceptions recorded.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filterState === "open" ? "default" : "outline"}
          onClick={() => setFilterState("open")}
        >
          Open ({counts.open})
        </Button>
        <Button
          size="sm"
          variant={filterState === "resolved" ? "default" : "outline"}
          onClick={() => setFilterState("resolved")}
        >
          Resolved ({counts.resolved})
        </Button>
        <Button
          size="sm"
          variant={filterState === "all" ? "default" : "outline"}
          onClick={() => setFilterState("all")}
        >
          All ({counts.all})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border text-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2 font-medium text-xs">Type</th>
              <th className="p-2 font-medium text-xs">Message</th>
              <th className="p-2 font-medium text-xs">Document</th>
              <th className="p-2 font-medium text-xs">Doc Status</th>
              <th className="p-2 font-medium text-xs">Resolved</th>
              <th className="p-2 font-medium text-xs">Created</th>
              <th className="p-2 font-medium text-xs">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2"><ExceptionTypeBadge code={row.code} /></td>
                <td className="p-2 max-w-xs truncate" title={row.message}>{row.message}</td>
                <td className="p-2">
                  {row.document_id ? (
                    <Link className="underline" href={`/ingestion/verification/${row.document_id}`}>
                      {row.document_filename ?? row.document_id.slice(0, 8) + "…"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">
                  {row.processing_status ? (
                    <Badge variant="outline">{row.processing_status}</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">
                  <Badge variant="outline" className={row.resolved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {row.resolved ? "Resolved" : "Open"}
                  </Badge>
                </td>
                <td className="p-2 font-mono text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                <td className="p-2">
                  {row.resolved ? (
                    "—"
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setResolveDialogId(row.id);
                        setDispositionNote("");
                      }}
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

      {filteredRows.length === 0 && (
        <p className="text-sm text-muted-foreground">No exceptions match this filter.</p>
      )}

      <Dialog open={!!resolveDialogId} onOpenChange={(open) => !open && setResolveDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              {resolveRow?.code}: {resolveRow?.message?.slice(0, 100)}
              {resolveRow && resolveRow.message.length > 100 ? "…" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Disposition note (required)</label>
            <Input
              placeholder="Describe how this was resolved..."
              value={dispositionNote}
              onChange={(e) => setDispositionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogId(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={pending || !dispositionNote.trim()}>
              {pending ? "Resolving…" : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
