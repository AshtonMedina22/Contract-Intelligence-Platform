import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteSearchProfile,
  saveSearchProfile,
  toggleSearchProfile,
} from "@/app/(platform)/procurement/opportunities/discover/actions";

export type SearchProfileListItem = {
  id: string;
  name: string;
  enabled: boolean;
  criteria: Record<string, unknown> | null;
  schedule_cron: string | null;
  last_run_at: string | null;
  last_error: string | null;
};

function criteriaText(criteria: Record<string, unknown> | null, key: string): string {
  const value = criteria?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/** Org-only dense form to list / create / edit opportunity search profiles. */
export function SearchProfilesPanel({ profiles }: { profiles: SearchProfileListItem[] }) {
  return (
    <details className="rounded-md border p-2">
      <summary className="cursor-pointer text-sm font-medium">
        Search profiles ({profiles.length})
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Enabled profiles are upserted by the daily public-opportunity sync cron against live
        providers only. Fixture/sample mode is skipped. Sync never invents notices.
      </p>

      {profiles.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Criteria</th>
                <th className="px-2 py-1">Schedule</th>
                <th className="px-2 py-1">Last run</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b align-top">
                  <td className="px-2 py-1">
                    <span className="font-medium">{profile.name}</span>{" "}
                    <Badge variant={profile.enabled ? "secondary" : "outline"}>
                      {profile.enabled ? "enabled" : "disabled"}
                    </Badge>
                    {profile.last_error ? (
                      <p className="text-red-600">{profile.last_error}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {[
                      criteriaText(profile.criteria, "keywords") &&
                        `kw=${criteriaText(profile.criteria, "keywords")}`,
                      criteriaText(profile.criteria, "naics") &&
                        `naics=${criteriaText(profile.criteria, "naics")}`,
                      criteriaText(profile.criteria, "state") &&
                        `state=${criteriaText(profile.criteria, "state")}`,
                      criteriaText(profile.criteria, "set_aside") &&
                        `set-aside=${criteriaText(profile.criteria, "set_aside")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {profile.schedule_cron ?? "daily cron"}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {profile.last_run_at
                      ? new Date(profile.last_run_at).toLocaleString()
                      : "never"}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      <form action={toggleSearchProfile}>
                        <input type="hidden" name="profile_id" value={profile.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={profile.enabled ? "0" : "1"}
                        />
                        <Button size="sm" variant="outline" type="submit">
                          {profile.enabled ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      <form action={deleteSearchProfile}>
                        <input type="hidden" name="profile_id" value={profile.id} />
                        <Button size="sm" variant="ghost" type="submit">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No profiles yet.</p>
      )}

      <form action={saveSearchProfile} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Name *</span>
          <Input name="name" required className="h-8 w-40" placeholder="TX security" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Keywords</span>
          <Input name="keywords" className="h-8 w-40" placeholder="security guard" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">NAICS</span>
          <Input name="naics" className="h-8 w-28" placeholder="561612" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Set-aside</span>
          <Input name="set_aside" className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">State</span>
          <Input name="state" className="h-8 w-20" placeholder="TX" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Buyer</span>
          <Input name="buyer" className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Due within (days)</span>
          <Input name="dueWithinDays" type="number" min="1" className="h-8 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Limit</span>
          <Input name="limit" type="number" min="1" max="100" defaultValue={25} className="h-8 w-20" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Schedule note</span>
          <Input name="schedule_cron" className="h-8 w-32" placeholder="0 14 * * *" />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="enabled" value="1" defaultChecked />
          Enabled
        </label>
        <Button size="sm" type="submit">
          Add profile
        </Button>
      </form>
    </details>
  );
}
