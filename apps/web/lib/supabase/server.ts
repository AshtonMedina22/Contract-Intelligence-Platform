import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { hasEnvVars } from "@/lib/utils";

/** Local Supabase demo anon key — used only when env vars are missing so RSC pages render instead of 500. */
const PLACEHOLDER_SUPABASE_URL = "http://127.0.0.1:54321";
const PLACEHOLDER_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = hasEnvVars ? process.env.NEXT_PUBLIC_SUPABASE_URL! : PLACEHOLDER_SUPABASE_URL;
  const key = hasEnvVars
    ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    : PLACEHOLDER_SUPABASE_KEY;

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
