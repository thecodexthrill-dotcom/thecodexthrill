import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (
    (pathname === "/invite/accept" || pathname === "/reset-password") &&
    (searchParams.has("token_hash") || searchParams.has("code"))
  ) {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("next", pathname);
    const tokenHash = searchParams.get("token_hash");
    const code = searchParams.get("code");
    const type = searchParams.get("type") ?? (pathname === "/invite/accept" ? "invite" : "recovery");
    if (tokenHash) callbackUrl.searchParams.set("token_hash", tokenHash);
    if (code) callbackUrl.searchParams.set("code", code);
    if (type) callbackUrl.searchParams.set("type", type);
    return NextResponse.redirect(callbackUrl, { status: 307 });
  }

  let response = NextResponse.next({ request });
  let env: ReturnType<typeof getSupabasePublicEnv>;
  try {
    env = getSupabasePublicEnv();
  } catch {
    return response;
  }

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        if (cacheHeaders) {
          for (const [name, value] of Object.entries(cacheHeaders)) {
            response.headers.set(name, value);
          }
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/continue",
    "/invite/:path*",
  ],
};
