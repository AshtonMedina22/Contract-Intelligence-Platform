import Link from "next/link";
import { Suspense } from "react";
import { SettingsNav } from "@/components/section-tabs";
import { DataLayerBadge } from "@/components/data-layer-badge";
import {
  DOCUMENT_TABLE_MAP,
  PILOT_PACKAGE_MAP,
  PROMOTE_CHAIN,
} from "@/lib/data-model/document-table-map";
import {
  LAYER_LABELS,
  RFQ_FLOW_STEPS,
  tablesForLayer,
  type DataLayer,
} from "@/lib/data-model/registry";

const LAYER_ORDER: DataLayer[] = ["staging", "canonical", "derived", "intelligence", "system"];

const STATUS_LABEL: Record<string, string> = {
  live: "Live fill",
  partial: "Partial",
  schema_ready: "Schema ready",
  deferred: "Deferred",
};

function DataModelContent() {
  return (
    <div className="max-w-4xl space-y-8">
      <SettingsNav />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Data model</h1>
        <p className="text-sm text-muted-foreground">
          Document type → commercial truth → promote RPCs → Postgres tables. This is the map from source
          evidence to the finished platform (Pursuits, Contracts, Intelligence, Ask). Full write-up:{" "}
          <code className="text-xs">docs/DOCUMENT_TABLE_MAPPING.md</code>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">New RFQ: data → output</h2>
        <ol className="space-y-2 border-l-2 pl-4">
          {RFQ_FLOW_STEPS.map((row) => (
            <li key={row.step} className="text-sm">
              <span className="font-medium">
                {row.step}. {row.label}
              </span>
              <span className="text-muted-foreground"> — table </span>
              <code className="font-mono text-xs">{row.table}</code>
              <span className="text-muted-foreground"> → </span>
              {row.output}
              <div>
                <Link className="text-xs underline" href={row.route}>
                  Open live view
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Promote chain (after HUMAN_VERIFIED)</h2>
        <p className="text-sm text-muted-foreground">
          Verification workbench runs all four RPCs in order. Pilot harness must match.
        </p>
        <ol className="list-inside list-decimal font-mono text-xs">
          {PROMOTE_CHAIN.map((rpc) => (
            <li key={rpc}>{rpc}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Document type → tables</h2>
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Document kinds</th>
                <th className="p-2">Truth</th>
                <th className="p-2">Target tables</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {DOCUMENT_TABLE_MAP.map((row) => (
                <tr key={row.documentTypes.join("|")} className="border-b align-top">
                  <td className="p-2">
                    <div className="font-mono text-xs">{row.documentTypes.slice(0, 3).join(", ")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.productSurface}</div>
                  </td>
                  <td className="p-2 font-mono text-xs">{row.commercialTruth}</td>
                  <td className="p-2 font-mono text-xs">{row.targetTables.join(", ")}</td>
                  <td className="p-2 text-xs">
                    {STATUS_LABEL[row.status] ?? row.status}
                    <div className="mt-1 text-muted-foreground">{row.notes}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pilot packages (A/B/C)</h2>
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Package</th>
                <th className="p-2">Class</th>
                <th className="p-2">Buyer</th>
                <th className="p-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PILOT_PACKAGE_MAP).map(([key, meta]) => (
                <tr key={key} className="border-b">
                  <td className="p-2 font-mono text-xs">{key}</td>
                  <td className="p-2 font-mono text-xs">{meta.corpusClass}</td>
                  <td className="p-2 text-xs">{meta.buyer}</td>
                  <td className="p-2 font-mono text-xs">{meta.srcIds.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Class C fills intelligence / schema-coverage tables only — never labeled as L&amp;P history.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Four commercial truths (never one rate field)</h2>
        <div className="overflow-x-auto rounded-md border text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Truth</th>
                <th className="p-2">Document tag</th>
                <th className="p-2">pricing_lines column</th>
                <th className="p-2">Live view</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Requested</td>
                <td className="p-2 font-mono text-xs">commercial_truth = requested</td>
                <td className="p-2 font-mono text-xs">requested_rate</td>
                <td className="p-2">
                  <Link className="underline" href="/pursuits">
                    Pursuits
                  </Link>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Proposed</td>
                <td className="p-2 font-mono text-xs">proposed</td>
                <td className="p-2 font-mono text-xs">proposed_rate</td>
                <td className="p-2">
                  <Link className="underline" href="/intelligence/pricing">
                    Pricing
                  </Link>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Awarded</td>
                <td className="p-2 font-mono text-xs">awarded</td>
                <td className="p-2 font-mono text-xs">awarded_rate · awards</td>
                <td className="p-2">
                  <Link className="underline" href="/pursuits">
                    Pursuits
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="p-2">Current</td>
                <td className="p-2 font-mono text-xs">current</td>
                <td className="p-2 font-mono text-xs">current_rate · contracts</td>
                <td className="p-2">
                  <Link className="underline" href="/contracts">
                    Contracts
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {LAYER_ORDER.map((layer) => {
        const tables = tablesForLayer(layer);
        if (tables.length === 0) return null;
        return (
          <section key={layer} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">{LAYER_LABELS[layer]}</h2>
              <DataLayerBadge layer={layer} />
            </div>
            <div className="space-y-3">
              {tables.map((entry) => (
                <div key={entry.table} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs font-semibold">{entry.table}</code>
                    <Link className="text-xs underline" href={entry.liveRoute}>
                      View rows
                    </Link>
                  </div>
                  <p className="mt-1 text-muted-foreground">{entry.purpose}</p>
                  <p className="mt-2 font-mono text-xs">{entry.keyColumns.join(" · ")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">In:</span> {entry.fedBy.join("; ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Out:</span> {entry.feeds.join("; ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-medium text-foreground">Governance</h2>
        <ul className="list-inside list-disc">
          <li>Map facts to live tables first; record unsupported end-state concepts as schema-gap findings.</li>
          <li>Do not invent L&amp;P prices, staffing, or loss reasons.</li>
          <li>
            Class C competitor documents verify for coverage — never promote as L&amp;P-authored history.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function DataModelPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DataModelContent />
    </Suspense>
  );
}
