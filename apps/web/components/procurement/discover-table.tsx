import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell";
import type { NormalizedPublicOpportunity, PublicSourceStatus } from "@/lib/procurement/providers";
import {
  dismissOpportunity,
  startPursuitAndOpen,
  watchOpportunity,
} from "@/app/(platform)/procurement/opportunities/discover/actions";
import {
  PublicSourceStatusBadge,
  discoverDisplayStatus,
} from "@/components/procurement/public-source-status-badge";

export type DiscoverRowState = {
  public_source_id: string;
  watchlisted: boolean;
  dismissed: boolean;
  opportunity_id: string | null;
  status?: PublicSourceStatus | null;
};

/** Every notice field travels with the action — Discover results are never persisted on view. */
function NoticeFields({ notice }: { notice: NormalizedPublicOpportunity }) {
  return (
    <>
      <input type="hidden" name="provider" value={notice.provider} />
      <input type="hidden" name="external_id" value={notice.external_id} />
      <input type="hidden" name="title" value={notice.title} />
      <input type="hidden" name="source_url" value={notice.source_url ?? ""} />
      <input type="hidden" name="buyer_name" value={notice.buyer_name ?? ""} />
      <input type="hidden" name="solicitation_number" value={notice.solicitation_number ?? ""} />
      <input type="hidden" name="procurement_type" value={notice.procurement_type ?? ""} />
      <input type="hidden" name="posted_on" value={notice.posted_on ?? ""} />
      <input type="hidden" name="due_on" value={notice.due_on ?? ""} />
      <input type="hidden" name="naics" value={notice.naics ?? ""} />
      <input type="hidden" name="psc" value={notice.psc ?? ""} />
      <input type="hidden" name="set_aside" value={notice.set_aside ?? ""} />
      <input type="hidden" name="geography" value={notice.geography ?? ""} />
      <input
        type="hidden"
        name="estimated_value"
        value={notice.estimated_value == null ? "" : String(notice.estimated_value)}
      />
      <input type="hidden" name="raw_payload" value={JSON.stringify(notice.raw_payload)} />
    </>
  );
}

export function DiscoverTable({
  notices,
  states,
}: {
  notices: NormalizedPublicOpportunity[];
  states: Map<string, DiscoverRowState>;
}) {
  if (notices.length === 0) {
    return (
      <EmptyState
        title="No public notices matched"
        description="Adjust the filters above. Discover only shows what the configured providers returned — it never generates opportunities."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="px-2 py-1.5">Notice ({notices.length})</th>
            <th className="px-2 py-1.5">Buyer as listed</th>
            <th className="px-2 py-1.5">Type</th>
            <th className="px-2 py-1.5">NAICS / PSC</th>
            <th className="px-2 py-1.5">Set-aside</th>
            <th className="px-2 py-1.5">Place</th>
            <th className="px-2 py-1.5">Posted</th>
            <th className="px-2 py-1.5">Due</th>
            <th className="px-2 py-1.5">Value</th>
            <th className="px-2 py-1.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {notices.map((notice) => {
            const key = `${notice.provider}:${notice.external_id}`;
            const state = states.get(key);
            const status = discoverDisplayStatus({
              status: state?.status,
              opportunity_id: state?.opportunity_id ?? null,
              watchlisted: state?.watchlisted ?? false,
              dismissed: state?.dismissed ?? false,
            });
            return (
              <tr key={key} className="border-b align-top">
                <td className="px-2 py-1.5">
                  {notice.source_url ? (
                    <a
                      className="font-medium underline"
                      href={notice.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {notice.title}
                    </a>
                  ) : (
                    <span className="font-medium">{notice.title}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {notice.solicitation_number ?? notice.external_id}
                  </p>
                  {notice.provider === "fixture" ? (
                    <Badge className="mt-1 mr-1" variant="outline">
                      sample
                    </Badge>
                  ) : null}
                  <PublicSourceStatusBadge status={status} />
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{notice.buyer_name ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{notice.procurement_type ?? "—"}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {notice.naics ?? "—"}
                  {notice.psc ? ` / ${notice.psc}` : ""}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{notice.set_aside ?? "—"}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{notice.geography ?? "—"}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{notice.posted_on ?? "—"}</td>
                <td className="px-2 py-1.5 text-xs">{notice.due_on ?? "—"}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {notice.estimated_value == null
                    ? "not published"
                    : notice.estimated_value.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {state?.watchlisted || status === "WATCHING" || status === "CONVERTED_TO_PURSUIT" ? null : (
                      <form action={watchOpportunity}>
                        <NoticeFields notice={notice} />
                        <Button size="sm" variant="outline" type="submit">
                          Watch
                        </Button>
                      </form>
                    )}
                    {state?.opportunity_id || status === "CONVERTED_TO_PURSUIT" ? null : (
                      <form action={startPursuitAndOpen}>
                        <NoticeFields notice={notice} />
                        {state?.public_source_id ? (
                          <input type="hidden" name="public_source_id" value={state.public_source_id} />
                        ) : null}
                        <Button size="sm" type="submit">
                          Start pursuit
                        </Button>
                      </form>
                    )}
                    {state?.dismissed || status === "DISMISSED" ? null : (
                      <form action={dismissOpportunity}>
                        <NoticeFields notice={notice} />
                        {state?.public_source_id ? (
                          <input type="hidden" name="public_source_id" value={state.public_source_id} />
                        ) : null}
                        <Button size="sm" variant="ghost" type="submit">
                          Dismiss
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
