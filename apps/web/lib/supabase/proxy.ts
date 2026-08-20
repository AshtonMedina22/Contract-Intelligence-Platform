import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { hasEnvVars } from "../utils";

function redirectWithCookies(url: URL, source: NextResponse) {
  const response = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  let user = data?.claims;

  const isDev = process.env.NODE_ENV === "development";
  const operatorEmail = process.env.LP_OPERATOR_EMAIL?.trim();
  const operatorPassword = process.env.LP_OPERATOR_PASSWORD;
  const onAuthPage = request.nextUrl.pathname.startsWith("/auth");

  if (isDev && !user && operatorEmail && operatorPassword) {
    const { data: signedIn, error } = await supabase.auth.signInWithPassword({
      email: operatorEmail,
      password: operatorPassword,
    });
    if (!error && signedIn.session) {
      const url = request.nextUrl.clone();
      if (onAuthPage) {
        url.pathname = "/overview";
        url.search = "";
      }
      return redirectWithCookies(url, supabaseResponse);
    }
  }

  if (isDev && user && onAuthPage && !request.nextUrl.pathname.startsWith("/auth/error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
