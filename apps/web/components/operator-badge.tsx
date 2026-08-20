import { createClient } from "@/lib/supabase/server";

export async function OperatorBadge() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <span className="text-xs text-muted-foreground">No session</span>;
  }

  return (
    <span className="truncate text-xs text-muted-foreground">
      {user.email ?? "Operator"}
    </span>
  );
}
