import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function RequirementsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p className="text-sm">Sign in to view requirements.</p>;

  const { data, error } = await supabase
    .from("requirements")
    .select("id, statement, solicitations(title, opportunity_id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Requirements</h1>
        <p className="text-sm text-muted-foreground">
          Canonical requirements come from verified solicitation facts, not awards.
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const sol = Array.isArray(row.solicitations) ? row.solicitations[0] : row.solicitations;
          return (
            <li key={row.id}>
              {row.statement}
              {sol?.opportunity_id ? (
                <>
                  {" "}
                  <Link className="underline" href={`/procurement/opportunities/${sol.opportunity_id}`}>
                    {sol.title}
                  </Link>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function RequirementsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <RequirementsContent />
    </Suspense>
  );
}
