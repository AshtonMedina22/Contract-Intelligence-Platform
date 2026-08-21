"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isDraftingAllowedSource, type SourceUsed } from "@/lib/opportunity/response";

export type WorkspaceSource = {
  chunk_id: string;
  reuse_status: string;
  content: string;
  document_id?: string | null;
  source_page?: number | null;
};

function reuseVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "REVIEW_REQUIRED") return "secondary";
  if (!isDraftingAllowedSource(status)) return "destructive";
  return "outline";
}

function SourceRow({
  source,
  selected,
  onToggle,
}: {
  source: WorkspaceSource;
  selected?: boolean;
  onToggle?: (chunkId: string) => void;
}) {
  return (
    <li className="rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        {onToggle ? (
          <label className="flex items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={() => onToggle(source.chunk_id)}
              aria-label={`Use passage ${source.chunk_id.slice(0, 8)} for drafting`}
            />
            Use for drafting
          </label>
        ) : null}
        <Badge variant={reuseVariant(source.reuse_status)} className="text-[10px]">
          {source.reuse_status}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          p.{source.source_page ?? "—"} · chunk {source.chunk_id.slice(0, 8)}
        </span>
        {source.document_id ? (
          <Link
            className="text-[11px] underline"
            href={`/ingestion/verification/${source.document_id}`}
          >
            View source
          </Link>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{source.content}</p>
    </li>
  );
}

/**
 * Provenance for the selected requirement, without leaving the Response workspace.
 *
 * Only drafting-allowed passages reach this sheet — DO_NOT_USE / SUPERSEDED are excluded by
 * `search_verified_knowledge` under PROPOSAL_DRAFTING and again by `parseSourcesUsed`.
 */
export function ResponseSourceSheet({
  open,
  onOpenChange,
  requirementStatement,
  retrieved,
  sourcesUsed,
  selectedSourceIds,
  onToggleSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementStatement: string | null;
  retrieved: WorkspaceSource[];
  sourcesUsed: SourceUsed[];
  selectedSourceIds?: string[];
  onToggleSource?: (chunkId: string) => void;
}) {
  const selected = new Set(selectedSourceIds ?? []);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-sm">Sources for this requirement</SheetTitle>
          <SheetDescription className="text-xs">
            {requirementStatement ?? "No requirement selected."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              Sources used by the saved response ({sourcesUsed.length})
            </h3>
            {sourcesUsed.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No response has been generated yet, so no passage is recorded as used.
              </p>
            ) : (
              <ul className="space-y-2">
                {sourcesUsed.map((s) => (
                  <SourceRow
                    key={`used-${s.chunk_id}`}
                    source={{
                      chunk_id: s.chunk_id,
                      reuse_status: s.reuse_status,
                      content: s.excerpt,
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              Retrieved evidence — PROPOSAL_DRAFTING ({retrieved.length})
            </h3>
            <p className="text-[11px] text-muted-foreground">
              DO_NOT_USE and SUPERSEDED passages are excluded from this purpose and cannot be
              selected for drafting.
            </p>
            {retrieved.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No allowed passage matched this requirement. That is L&P INPUT REQUIRED, not an
                empty answer to write around.
              </p>
            ) : (
              <ul className="space-y-2">
                {retrieved.map((s) => (
                  <SourceRow
                    key={`hit-${s.chunk_id}`}
                    source={s}
                    selected={selected.has(s.chunk_id)}
                    onToggle={onToggleSource}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
