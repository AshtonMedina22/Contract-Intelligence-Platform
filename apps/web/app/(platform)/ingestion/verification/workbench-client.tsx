"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";
import {
  applyFactDecision,
  completeDocumentVerification,
  recordViewSource,
  resolveValidationException,
  verifyFactGroup,
} from "./actions";
import { PdfSourcePane } from "./pdf-source-pane";
import { XlsxSourcePane } from "./xlsx-source-pane";

export type WorkbenchFact = {
  id: string;
  field: string;
  entity: string | null;
  raw_value: string | null;
  normalized_value: string | null;
  verified_value: string | null;
  verification_status: FactVerificationStatus;
  confidence: number | null;
  source_page: number | null;
  source_section: string | null;
  source_excerpt: string | null;
};

export type WorkbenchSheet = {
  name: string;
  cells: {
    sheet: string;
    coordinate: string;
    display_value?: string | null;
    cached_value?: string | null;
    formula?: string | null;
  }[];
};

type Props = {
  documentId: string;
  filename: string;
  mimeType: string | null;
  pdfUrl: string | null;
  sheets: WorkbenchSheet[];
  facts: WorkbenchFact[];
  processingStatus: string;
  openExceptionIds?: string[];
};

const OPEN: FactVerificationStatus[] = ["AI_EXTRACTED", "NEEDS_REVIEW", "CONFLICT"];

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, WorkbenchFact>();

export function WorkbenchClient({
  documentId,
  filename,
  mimeType,
  pdfUrl,
  sheets,
  facts,
  processingStatus,
  openExceptionIds = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [fieldFilter, setFieldFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState(facts[0]?.id ?? null);
  const [sourceFocus, setSourceFocus] = useState(0);

  const filtered = useMemo(() => {
    return facts.filter((fact) => {
      if (statusFilter === "open" && !OPEN.includes(fact.verification_status)) return false;
      if (statusFilter !== "all" && statusFilter !== "open" && fact.verification_status !== statusFilter) {
        return false;
      }
      if (fieldFilter && !fact.field.toLowerCase().includes(fieldFilter.toLowerCase())) return false;
      return true;
    });
  }, [facts, statusFilter, fieldFilter]);

  const selected = filtered.find((fact) => fact.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    const fact = facts.find((item) => item.id === selectedId) ?? facts[0];
    if (fact) {
      setDraft(fact.verified_value ?? fact.normalized_value ?? fact.raw_value ?? "");
    }
  }, [selectedId, facts]);

  const run = useCallback(
    (action: "VERIFY" | "EDIT" | "REJECT" | "FLAG_CONFLICT") => {
      if (!selected) return;
      startTransition(async () => {
        const result = await applyFactDecision({
          factId: selected.id,
          action: action === "VERIFY" && draft !== (selected.normalized_value ?? selected.raw_value) ? "EDIT" : action,
          value: draft,
        });
        setMessage(result.error ?? `${action} saved.`);
      });
    },
    [selected, draft],
  );

  const runGroup = useCallback(() => {
    if (!selected) return;
    const sheet = selected.source_section?.split("!")[0];
    const ids = facts
      .filter((fact) => {
        if (!OPEN.includes(fact.verification_status)) return false;
        if (selected.source_page && fact.source_page === selected.source_page) return true;
        if (sheet && fact.source_section?.startsWith(`${sheet}!`)) return true;
        return false;
      })
      .map((fact) => fact.id);
    startTransition(async () => {
      const result = await verifyFactGroup(ids.length > 0 ? ids : [selected.id]);
      setMessage(result.error ?? `Verified group (${Math.max(ids.length, 1)}).`);
    });
  }, [selected, facts]);

  const viewSource = useCallback(() => {
    if (!selected) return;
    setSourceFocus((n) => n + 1);
    startTransition(async () => {
      const result = await recordViewSource({
        documentId,
        factId: selected.id,
        page: selected.source_page,
        section: selected.source_section,
      });
      setMessage(result.error ?? "VIEW SOURCE audited.");
    });
  }, [selected, documentId]);

  const resolveOpen = useCallback(() => {
    if (openExceptionIds.length === 0) return;
    startTransition(async () => {
      for (const id of openExceptionIds) {
        const result = await resolveValidationException({
          exceptionId: id,
          note: `Resolved from verification workbench for ${filename}`,
        });
        if (result.error) {
          setMessage(result.error);
          return;
        }
      }
      setMessage(`RESOLVE: ${openExceptionIds.length} exception(s) closed.`);
    });
  }, [openExceptionIds, filename]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!selected) return;
      const index = filtered.findIndex((fact) => fact.id === selected.id);
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedId(filtered[Math.min(index + 1, filtered.length - 1)]?.id ?? selected.id);
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedId(filtered[Math.max(index - 1, 0)]?.id ?? selected.id);
      }
      if (event.key === "v") {
        event.preventDefault();
        run("VERIFY");
      }
      if (event.key === "r") {
        event.preventDefault();
        run("REJECT");
      }
      if (event.key === "c") {
        event.preventDefault();
        run("FLAG_CONFLICT");
      }
      if (event.key === "g") {
        event.preventDefault();
        runGroup();
      }
      if (event.key === "s") {
        event.preventDefault();
        viewSource();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, filtered, run, runGroup, viewSource]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("field", { header: "Field" }),
        helper.accessor("verification_status", {
          header: "Status",
          cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
        }),
        helper.accessor((row) => row.normalized_value ?? row.raw_value ?? "", {
          id: "value",
          header: "Value",
          cell: (ctx) => <span className="line-clamp-1 text-xs">{String(ctx.getValue())}</span>,
        }),
        helper.accessor((row) => row.source_section ?? (row.source_page != null ? `p.${row.source_page}` : "—"), {
          id: "source",
          header: "Source",
          cell: (ctx) => <span className="font-mono text-xs">{String(ctx.getValue())}</span>,
        }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: filtered,
  });

  const isPdf = (mimeType ?? "").includes("pdf") || filename.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{filename}</h1>
          <p className="text-sm text-muted-foreground">
            Status {processingStatus}. Keys: j/k move, v verify, r reject, c conflict, g verify group, s view
            source. Unverified facts never become canonical.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/ingestion/verification">Queue</Link>
          </Button>
          {openExceptionIds.length > 0 ? (
            <Button variant="secondary" disabled={pending} onClick={resolveOpen}>
              Resolve ({openExceptionIds.length})
            </Button>
          ) : null}
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await completeDocumentVerification(documentId);
                setMessage(result.error ?? "Document verification complete.");
              })
            }
          >
            Complete verification
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-[70vh] rounded-md border"
      >
        <ResizablePanel defaultSize={50} minSize={30} className="p-3">
          <div key={sourceFocus} className="h-full">
            {isPdf ? (
              <PdfSourcePane
                fileUrl={pdfUrl}
                page={selected?.source_page ?? 1}
                excerpt={selected?.source_excerpt ?? selected?.source_section ?? null}
              />
            ) : (
              <XlsxSourcePane sheets={sheets} activeSection={selected?.source_section ?? null} />
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30} className="space-y-3 overflow-auto p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.currentTarget.value)}
              >
                <option value="open">Open</option>
                <option value="all">All</option>
                <option value="AI_EXTRACTED">AI_EXTRACTED</option>
                <option value="HUMAN_VERIFIED">HUMAN_VERIFIED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CONFLICT">CONFLICT</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="field">Field</Label>
              <Input
                id="field"
                value={fieldFilter}
                onChange={(event) => setFieldFilter(event.currentTarget.value)}
                placeholder="Pricing!B1"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.original.id === selected?.id ? "selected" : undefined}
                    className="cursor-pointer data-[state=selected]:bg-muted"
                    onClick={() => setSelectedId(row.original.id)}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selected ? (
            <div className="space-y-2">
              <Label htmlFor="value">Verified value</Label>
              <Input id="value" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
              <p className="text-xs text-muted-foreground">
                {selected.source_section ?? `page ${selected.source_page ?? "?"}`}
                {selected.confidence != null ? ` · confidence ${selected.confidence}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => run("VERIFY")}>
                  Verify
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("EDIT")}>
                  Edit + verify
                </Button>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => run("REJECT")}>
                  Reject
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run("FLAG_CONFLICT")}>
                  Flag conflict
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={runGroup}>
                  Verify group
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={viewSource}>
                  View source
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No facts match these filters.</p>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
