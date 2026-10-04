import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";
import { resolveAppOrigin } from "@/lib/app-origin";
import { classifyAuthLinkError } from "@/lib/supabase/auth-link-status";
import { parseAuthCallbackParams } from "@/lib/supabase/auth-callback";

type LinkStatus = "expired" | "used" | "invalid";

function classifyLinkError(code: string): LinkStatus {
  return classifyAuthLinkError(code);
}

function statusRedirect(destination: string, origin: string, status: LinkStatus | "session-unavailable") {
  const target = destination === "/invite/accept"
    ? `/invite/accept?invite=${status === "session-unavailable" ? "invalid" : status}`
    : destination === "/reset-password"
      ? `/reset-password?auth=${status === "invalid" ? "link-invalid" : status}`
      : `/login?auth=${status === "session-unavailable" ? status : "link-invalid"}`;
  return NextResponse.redirect(new URL(target, origin));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { code, tokenHash, otpType, next } = parseAuthCallbackParams(url.searchParams);

  const configuredBase = resolveAppOrigin(new URL("/", request.url).origin);
  if (!configuredBase) {
    return NextResponse.json({ error: "The authentication callback base URL is invalid." }, { status: 500 });
  }
  const callbackBase = new URL(request.url);
  const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  // Preserve the callback hostname locally so its session cookies reach the next request.
  const redirectBase = isLoopback(configuredBase.hostname) && isLoopback(callbackBase.hostname)
    && configuredBase.port === callbackBase.port
    ? callbackBase
    : configuredBase;
  const redirectOrigin = redirectBase.origin;

  const callbackError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (callbackError && (next === "/invite/accept" || next === "/reset-password")) {
    const status = classifyLinkError(callbackError);
    console.info("[auth.callback] provider rejected link", { destination: next, status });
    return statusRedirect(next, redirectOrigin, status);
  }

  // Legacy implicit callbacks return session material in the fragment. Keep it browser-only.
  if (!code && !tokenHash && (next === "/invite/accept" || next === "/reset-password")) {
    const handoffPath = next;
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const script = 'const target="' + handoffPath + '";const p=new URLSearchParams(window.location.hash.slice(1));if(p.has("error")||p.has("error_code")||p.has("error_description")){const c=(p.get("error_code")||p.get("error")||"").toLowerCase();const s=c.includes("expired")?"expired":c.includes("used")||c.includes("already")?"used":"invalid";if(target==="/reset-password"){window.location.replace(target+"?auth="+(s==="invalid"?"link-invalid":s))}else{window.location.replace(target+"?invite="+s)}}else{window.location.replace(target+window.location.hash)}';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>Continue securely</title></head><body><p>Continuing securely...</p><script nonce="' + nonce + '">' + script + '</script></body></html>';
    const response = new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    response.headers.set("content-security-policy", "default-src 'none'; script-src 'nonce-" + nonce + "'; base-uri 'none'; frame-ancestors 'none'");
    return response;
  }

  const response = NextResponse.redirect(new URL(next, redirectOrigin));
  response.headers.set("cache-control", "no-store");
  const { url: supabaseUrl, key: supabaseKey } = getSupabasePublicEnv();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update the in-flight request and the redirect response as required by SSR cookie rotation.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const flow = code ? "pkce_code" : tokenHash ? "token_hash" : "missing_credentials";
  let verificationError: { code?: string; name?: string } | null = null;
  let sessionReturned = false;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    verificationError = result.error;
    sessionReturned = Boolean(result.data.session);
  } else if (tokenHash && otpType) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    verificationError = result.error;
    sessionReturned = Boolean(result.data.session);
  } else {
    console.info("[auth.callback] link has no supported verification parameters", { flow, otpType: otpType ?? "unsupported" });
    return statusRedirect(next, redirectOrigin, "invalid");
  }

  if (verificationError) {
    const status = classifyLinkError(verificationError.code ?? verificationError.name ?? "");
    console.info("[auth.callback] OTP verification failed", { flow, otpType: otpType ?? "code", status });
    return statusRedirect(next, redirectOrigin, status);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const sessionCookiePresent = response.cookies.getAll().some(({ name }) => /-auth-token(?:\.\d+)?$/.test(name));
  const sessionEstablished = sessionReturned && Boolean(user) && !userError && sessionCookiePresent;
  console.info("[auth.callback] session handoff", {
    flow,
    otpType: otpType ?? "code",
    sessionReturned,
    userVerified: Boolean(user) && !userError,
    sessionCookiePresent,
    sessionEstablished,
  });

  if (!sessionEstablished) {
    return statusRedirect(next, redirectOrigin, "session-unavailable");
  }

  return response;
}
