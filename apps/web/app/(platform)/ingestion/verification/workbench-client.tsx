"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";
import {
  applyFactDecision,
  completeDocumentVerification,
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
};

const OPEN: FactVerificationStatus[] = ["AI_EXTRACTED", "NEEDS_REVIEW", "CONFLICT"];

export function WorkbenchClient({
  documentId,
  filename,
  mimeType,
  pdfUrl,
  sheets,
  facts,
  processingStatus,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [fieldFilter, setFieldFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState(facts[0]?.id ?? null);

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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, filtered, run, runGroup]);

  const isPdf = (mimeType ?? "").includes("pdf") || filename.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{filename}</h1>
          <p className="text-sm text-muted-foreground">
            Status {processingStatus}. Keys: j/k move, v verify, r reject, c conflict, g verify group. Unverified
            facts never become canonical rates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/ingestion/verification">Queue</Link>
          </Button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border p-3">
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

        <div className="space-y-3 rounded-md border p-3">
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

          <ul className="max-h-56 space-y-1 overflow-auto text-sm">
            {filtered.map((fact) => (
              <li key={fact.id}>
                <button
                  type="button"
                  className={`w-full rounded-md border px-2 py-1 text-left ${
                    fact.id === selected?.id ? "border-primary bg-muted" : "border-transparent"
                  }`}
                  onClick={() => setSelectedId(fact.id)}
                >
                  <span className="font-medium">{fact.field}</span>{" "}
                  <Badge variant="outline">{fact.verification_status}</Badge>
                  <div className="truncate text-xs text-muted-foreground">
                    {fact.normalized_value ?? fact.raw_value}
                  </div>
                </button>
              </li>
            ))}
          </ul>

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
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No facts match these filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
