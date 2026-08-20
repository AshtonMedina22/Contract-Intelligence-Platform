"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveStaffingRequirement,
  deleteStaffingRequirement,
} from "@/app/(platform)/procurement/opportunities/[opportunityId]/actions";

export type StaffingRow = {
  id: string;
  post_label: string;
  armed: boolean | null;
  shift_hours: number | null;
  posts_count: number | null;
  weekly_hours: number | null;
  clearance_note: string | null;
  notes: string | null;
  labor_category: string | null;
};

export function StaffingRequirementsPanel({
  opportunityId,
  rows,
}: {
  opportunityId: string;
  rows: StaffingRow[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Staffing post orders</h2>
        <p className="text-xs text-muted-foreground">
          Ops-entered grid until verified extraction promotes rows. Used for proposal staffing plans and cost
          modeling.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">Post</th>
                <th className="p-2">Labor cat</th>
                <th className="p-2">Armed</th>
                <th className="p-2">Posts</th>
                <th className="p-2">Shift hrs</th>
                <th className="p-2">Weekly hrs</th>
                <th className="p-2">Clearance</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2 font-medium">{row.post_label}</td>
                  <td className="p-2 text-muted-foreground">{row.labor_category ?? "—"}</td>
                  <td className="p-2">{row.armed == null ? "—" : row.armed ? "Yes" : "No"}</td>
                  <td className="p-2">{row.posts_count ?? "—"}</td>
                  <td className="p-2">{row.shift_hours ?? "—"}</td>
                  <td className="p-2">{row.weekly_hours ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{row.clearance_note ?? "—"}</td>
                  <td className="p-2">
                    <form
                      action={() => {
                        startTransition(async () => {
                          await deleteStaffingRequirement(opportunityId, row.id);
                        });
                      }}
                    >
                      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                        Remove
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No staffing rows yet. Add posts from the solicitation SOW.</p>
      )}

      <form
        className="max-w-2xl space-y-3 rounded-md border p-4"
        action={(formData) => {
          startTransition(async () => {
            await saveStaffingRequirement(opportunityId, formData);
          });
        }}
      >
        <h3 className="text-sm font-medium">Add post</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="post_label">Post label</Label>
            <Input id="post_label" name="post_label" required placeholder="Main lobby — armed, 24/7" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="labor_category">Labor category (must match a cost model name)</Label>
            <Input id="labor_category" name="labor_category" placeholder="Leave blank if only one cost model exists" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="armed">Armed</Label>
            <select
              id="armed"
              name="armed"
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              defaultValue=""
            >
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="posts_count">Number of posts</Label>
            <Input id="posts_count" name="posts_count" type="number" min="0" step="1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shift_hours">Hours per shift</Label>
            <Input id="shift_hours" name="shift_hours" type="number" min="0" step="0.5" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weekly_hours">Weekly hours (total)</Label>
            <Input id="weekly_hours" name="weekly_hours" type="number" min="0" step="0.5" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clearance_note">Clearance / cert</Label>
            <Input id="clearance_note" name="clearance_note" placeholder="TX DPS Level III, etc." />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Supervisor on site weekends" />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add staffing row"}
        </Button>
      </form>
    </div>
  );
}
