import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, hasAuthCookie, supabaseAuthConfig } from "./lib/supabase-config";

export async function proxy(request: NextRequest) {
  if (!hasAuthCookie(request.cookies.getAll())) return NextResponse.next();
  const { url, key } = supabaseAuthConfig();
  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });
  await client.auth.getClaims();
  return response;
}

export const config = { matcher: ["/admin/:path*", "/conta/:path*", "/produtos/:slug", "/api/manage/:path*", "/api/account/:path*", "/api/checkout", "/api/plaque-reference"] };
