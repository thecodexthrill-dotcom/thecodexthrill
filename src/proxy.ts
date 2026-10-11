import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env";
import { buildProxyAuthCallbackRedirect } from "@/lib/supabase/auth-callback";

export async function proxy(request: NextRequest) {
  const callbackRedirect = buildProxyAuthCallbackRedirect(request.nextUrl);
  if (callbackRedirect) {
    return NextResponse.redirect(callbackRedirect, {
      status: 307,
      headers: { "cache-control": "no-store" },
    });
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.next({ request });
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
    "/",
    "/admin/:path*",
    "/portal/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/continue",
    "/invite/:path*",
  ],
};
