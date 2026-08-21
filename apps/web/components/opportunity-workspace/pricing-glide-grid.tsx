"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataEditor, {
  CompactSelection,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  Item,
  Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { PricingLineRow } from "@/lib/opportunity/types";
import {
  EMPTY_CELL,
  PRICING_FREEZE_COLUMNS,
  PRICING_IDENTIFIER_COLUMN_IDS,
  PRICING_TRUTH_COLUMNS,
  PRICING_TRUTH_LEGEND_CLASS,
  PRICING_TRUTH_TINTS,
  blendRgb,
  formatCurrency,
  formatQuantity,
  hslTripletToRgb,
  isGridEditableTruth,
  rgbToHex,
  truthCoverage,
  truthFactId,
  truthRate,
  type PricingTruthId,
  type Rgb,
} from "@/lib/opportunity/pricing-grid-model";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

type ColumnSpec = GridColumn & { readonly id: string; readonly truth?: PricingTruthId };

/**
 * Column groups run in commercial-truth order — Buyer requested | L&P internal cost |
 * L&P submitted | Buyer awarded | Current/amended — and every group title is taken from
 * `PRICING_TRUTH_COLUMNS`, so the grid cannot drift from the shared model or merge two truths
 * into one column. The first `PRICING_FREEZE_COLUMNS` columns are the identifier grain and stay
 * pinned while the truths scroll.
 */
function buildColumns(): ColumnSpec[] {
  const identifiers: ColumnSpec[] = [
    { id: "labor_category", title: "Labor category", group: "Line", width: 190 },
    { id: "site_or_post", title: "Site / post", width: 130, group: "Line" },
    { id: "unit", title: "Unit", width: 80, group: "Line" },
  ];
  if (identifiers.length !== PRICING_FREEZE_COLUMNS) {
    throw new Error("Frozen identifier columns must lead the column order.");
  }
  const grain: ColumnSpec[] = [
    { id: "rate_type", title: "Rate type", width: 110, group: "Grain" },
    { id: "quantity", title: "Qty", width: 80, group: "Grain" },
  ];

  const truths: ColumnSpec[] = [];
  for (const truth of PRICING_TRUTH_COLUMNS) {
    truths.push({
      id: truth.rateKey,
      truth: truth.id,
      title: "Rate ($)",
      group: truth.label,
      width: 118,
    });
    if (truth.factKey) {
      truths.push({
        id: truth.factKey,
        truth: truth.id,
        title: "Source",
        group: truth.label,
        width: 92,
      });
    }
  }

  return [
    ...identifiers,
    ...grain,
    ...truths,
    { id: "extended_amount", title: "Extended ($)", width: 120, group: "Extended" },
  ];
}

const COLUMNS = buildColumns();

function readTriplet(styles: CSSStyleDeclaration, name: string, fallback: Rgb): Rgb {
  return hslTripletToRgb(styles.getPropertyValue(name)) ?? fallback;
}

type ResolvedPalette = {
  readonly theme: Partial<Theme>;
  /** Opaque per-truth cell background, pre-blended because Glide paints cells on canvas. */
  readonly truthBg: Record<PricingTruthId, string>;
  readonly truthHeaderBg: Record<PricingTruthId, string>;
  readonly hoverBg: string;
};

/**
 * Glide draws on a canvas, so `hsl(var(--muted))` never resolves. Read the shadcn tokens once
 * and re-read them when the theme class flips.
 */
function usePalette(): ResolvedPalette {
  const [palette, setPalette] = useState<ResolvedPalette>(() => resolvePalette());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setPalette(resolvePalette()));
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    setPalette(resolvePalette());
    return () => observer.disconnect();
  }, []);

  return palette;
}

function resolvePalette(): ResolvedPalette {
  const fallback: ResolvedPalette = {
    theme: {},
    truthBg: {
      requested: "#ffffff",
      internal_cost: "#ffffff",
      proposed: "#ffffff",
      awarded: "#ffffff",
      current: "#ffffff",
    },
    truthHeaderBg: {
      requested: "#f4f4f5",
      internal_cost: "#f4f4f5",
      proposed: "#f4f4f5",
      awarded: "#f4f4f5",
      current: "#f4f4f5",
    },
    hoverBg: "#f4f4f5",
  };
  if (typeof window === "undefined") return fallback;

  const styles = window.getComputedStyle(document.documentElement);
  const bg = readTriplet(styles, "--background", [255, 255, 255]);
  const fg = readTriplet(styles, "--foreground", [10, 10, 10]);
  const muted = readTriplet(styles, "--muted", [244, 244, 245]);
  const mutedFg = readTriplet(styles, "--muted-foreground", [115, 115, 115]);
  const border = readTriplet(styles, "--border", [229, 229, 229]);
  const accent = readTriplet(styles, "--primary", [24, 24, 27]);

  const truthBg = {} as Record<PricingTruthId, string>;
  const truthHeaderBg = {} as Record<PricingTruthId, string>;
  for (const truth of PRICING_TRUTH_COLUMNS) {
    const tint = PRICING_TRUTH_TINTS[truth.id];
    truthBg[truth.id] = rgbToHex(blendRgb(bg, tint, 0.06));
    truthHeaderBg[truth.id] = rgbToHex(blendRgb(muted, tint, 0.22));
  }

  return {
    theme: {
      accentColor: rgbToHex(accent),
      accentLight: rgbToHex(blendRgb(bg, accent, 0.12)),
      bgCell: rgbToHex(bg),
      bgCellMedium: rgbToHex(blendRgb(bg, muted, 0.5)),
      bgHeader: rgbToHex(muted),
      bgHeaderHovered: rgbToHex(blendRgb(muted, fg, 0.06)),
      bgHeaderHasFocus: rgbToHex(blendRgb(muted, fg, 0.1)),
      textDark: rgbToHex(fg),
      textMedium: rgbToHex(mutedFg),
      textLight: rgbToHex(blendRgb(bg, mutedFg, 0.7)),
      textHeader: rgbToHex(fg),
      textGroupHeader: rgbToHex(fg),
      borderColor: rgbToHex(border),
      horizontalBorderColor: rgbToHex(border),
      headerBottomBorderColor: rgbToHex(border),
      linkColor: rgbToHex(accent),
      cellHorizontalPadding: 8,
      cellVerticalPadding: 3,
      headerFontStyle: "600 11px",
      baseFontStyle: "12px",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: 1.3,
    },
    truthBg,
    truthHeaderBg,
    hoverBg: rgbToHex(blendRgb(bg, muted, 0.85)),
  };
}

function textCell(display: string): GridCell {
  return {
    kind: GridCellKind.Text,
    data: display,
    displayData: display,
    allowOverlay: false,
    readonly: true,
  };
}

/** Rate columns read as currency; an absent rate stays a dash and never becomes 0.00. */
function currencyCell(value: number | null): GridCell {
  if (value == null || !Number.isFinite(value)) {
    return {
      kind: GridCellKind.Number,
      data: undefined,
      displayData: EMPTY_CELL,
      allowOverlay: false,
      readonly: true,
    };
  }
  return {
    kind: GridCellKind.Number,
    data: value,
    displayData: formatCurrency(value),
    allowOverlay: false,
    readonly: true,
    fixedDecimals: 2,
    thousandSeparator: true,
  };
}

/** Source evidence cell — clicking it opens the verification workbench for that document. */
function sourceCell(
  factId: string | null,
  documentId: string | null,
  onOpen: (documentId: string) => void,
): GridCell {
  if (!factId) return textCell(EMPTY_CELL);
  const label = `${factId.slice(0, 8)}…`;
  if (!documentId) {
    return {
      kind: GridCellKind.Text,
      data: factId,
      displayData: label,
      allowOverlay: false,
      readonly: true,
    };
  }
  return {
    kind: GridCellKind.Uri,
    data: `/ingestion/verification/${documentId}`,
    displayData: label,
    allowOverlay: false,
    readonly: true,
    hoverEffect: true,
    onClickUri: (args) => {
      args.preventDefault();
      onOpen(documentId);
    },
  };
}

type CellFocus = { readonly line: PricingLineRow; readonly truth: PricingTruthId };

/**
 * Read-only Glide workbench over the five commercial truths. Nothing here writes: each truth
 * carries the human path that may change it, and source cells open the verification workbench.
 */
export function PricingGlideGrid({
  lines,
  factDocumentMap,
  onJumpToCostModel,
}: {
  lines: PricingLineRow[];
  factDocumentMap?: Map<string, string>;
  onJumpToCostModel?: (laborCategory: string) => void;
}) {
  const palette = usePalette();
  const [hoverRow, setHoverRow] = useState<number | undefined>();
  const [focus, setFocus] = useState<CellFocus | null>(null);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const docFor = useCallback(
    (factId: string | null | undefined) =>
      factId && factDocumentMap ? (factDocumentMap.get(factId) ?? null) : null,
    [factDocumentMap],
  );

  const openVerification = useCallback((documentId: string) => {
    window.location.href = `/ingestion/verification/${documentId}`;
  }, []);

  const columns = useMemo<GridColumn[]>(
    () =>
      COLUMNS.map((column) => {
        if (!column.truth) return column;
        return {
          ...column,
          themeOverride: {
            bgCell: palette.truthBg[column.truth],
            bgHeader: palette.truthHeaderBg[column.truth],
          },
        };
      }),
    [palette],
  );

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const line = lines[row];
      const column = COLUMNS[col];
      if (!line || !column) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (column.truth) {
        const truth = PRICING_TRUTH_COLUMNS.find((t) => t.id === column.truth)!;
        if (column.id === truth.factKey) {
          const factId = truthFactId(line, truth.id);
          return sourceCell(factId, docFor(factId), openVerification);
        }
        return currencyCell(truthRate(line, truth.id));
      }

      switch (column.id) {
        case "labor_category":
          return textCell(line.labor_category || EMPTY_CELL);
        case "site_or_post":
          return textCell(line.site_or_post || EMPTY_CELL);
        case "unit":
          return textCell(line.unit || EMPTY_CELL);
        case "rate_type":
          return textCell(line.rate_type || EMPTY_CELL);
        case "quantity":
          return textCell(formatQuantity(line.quantity));
        case "extended_amount":
          return currencyCell(line.extended_amount);
        default:
          return textCell(EMPTY_CELL);
      }
    },
    [lines, docFor, openVerification],
  );

  const onCellClicked = useCallback(
    ([col, row]: Item) => {
      const column = COLUMNS[col];
      const line = lines[row];
      if (!column || !line) return;
      if (column.truth && column.id !== "extended_amount") {
        setFocus({ line, truth: column.truth });
      }
    },
    [lines],
  );

  const coverage = useMemo(() => truthCoverage(lines), [lines]);
  const selectedRows = selection.rows.length;
  const height = useMemo(
    () => Math.min(560, 24 + 30 + 30 + Math.max(lines.length, 1) * 30),
    [lines.length],
  );

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-background/95 py-1.5 text-xs backdrop-blur">
        {PRICING_TRUTH_COLUMNS.map((truth) => (
          <span key={truth.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block size-2 rounded-sm ${PRICING_TRUTH_LEGEND_CLASS[truth.id]}`}
            />
            <span className="font-medium">{truth.label}</span>
            <span className="text-muted-foreground">
              {coverage[truth.id]}/{lines.length}
            </span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            Read-only
          </Badge>
          {selectedRows > 0 ? <span>{selectedRows} row(s) selected · Ctrl/Cmd+C copies</span> : null}
        </span>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            No verified pricing lines yet. Promote HUMAN_VERIFIED rates from intake — AI staging never
            appears here. All five truth columns stay in this grid even when every one of them is empty.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-background">
          <DataEditor
            getCellContent={getCellContent}
            columns={columns}
            rows={lines.length}
            height={height}
            width="100%"
            theme={palette.theme}
            freezeColumns={PRICING_FREEZE_COLUMNS}
            headerHeight={30}
            groupHeaderHeight={26}
            rowHeight={30}
            rowMarkers="both"
            rowSelect="multi"
            rangeSelect="multi-rect"
            columnSelect="none"
            copyHeaders
            smoothScrollX
            smoothScrollY
            getCellsForSelection
            onPaste={false}
            onCellClicked={onCellClicked}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onItemHovered={(args) => {
              setHoverRow(args.kind === "cell" ? args.location[1] : undefined);
            }}
            getRowThemeOverride={(row) =>
              row === hoverRow ? { bgCell: palette.hoverBg } : undefined
            }
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Identifier columns ({PRICING_IDENTIFIER_COLUMN_IDS.join(" · ")}) stay pinned. Rate cells are
        read-only and paste is disabled — a canonical rate only changes by verifying its document and
        promoting the fact. Click a rate to see its provenance; click a Source cell to open
        verification.
      </p>

      <TruthCellSheet
        focus={focus}
        factDocumentMap={factDocumentMap}
        onClose={() => setFocus(null)}
        onJumpToCostModel={onJumpToCostModel}
      />
    </div>
  );
}

function TruthCellSheet({
  focus,
  factDocumentMap,
  onClose,
  onJumpToCostModel,
}: {
  focus: CellFocus | null;
  factDocumentMap?: Map<string, string>;
  onClose: () => void;
  onJumpToCostModel?: (laborCategory: string) => void;
}) {
  const truth = focus ? PRICING_TRUTH_COLUMNS.find((t) => t.id === focus.truth)! : null;
  const factId = focus && truth ? truthFactId(focus.line, truth.id) : null;
  const documentId = factId ? (factDocumentMap?.get(factId) ?? null) : null;

  return (
    <Sheet open={focus !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {focus && truth ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{truth.label}</SheetTitle>
              <SheetDescription>
                {focus.line.labor_category}
                {focus.line.site_or_post ? ` · ${focus.line.site_or_post}` : ""}
                {focus.line.unit ? ` · per ${focus.line.unit}` : ""}
              </SheetDescription>
            </SheetHeader>
            <dl className="space-y-3 p-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Rate</dt>
                <dd className="font-medium">{formatCurrency(truthRate(focus.line, truth.id))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Provenance</dt>
                <dd>
                  {truth.provenance === "PROMOTED_VERIFIED"
                    ? "Promoted from a HUMAN_VERIFIED extracted fact"
                    : "Planning figure from the internal cost model — not buyer evidence"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">How this changes</dt>
                <dd>{truth.editPath}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Editable in grid</dt>
                <dd>{isGridEditableTruth(truth.id) ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source fact</dt>
                <dd className="font-mono text-xs break-all">
                  {factId ?? (truth.factKey ? "none — rate present without evidence" : "not applicable")}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 border-t p-4">
              {documentId ? (
                <Link
                  className="text-sm underline"
                  href={`/ingestion/verification/${documentId}`}
                >
                  View source document
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No source document reachable for this cell.
                </span>
              )}
              {truth.provenance === "PLANNING_COST_MODEL" && onJumpToCostModel ? (
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => {
                    onJumpToCostModel(focus.line.labor_category);
                    onClose();
                  }}
                >
                  Open cost model for {focus.line.labor_category}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
