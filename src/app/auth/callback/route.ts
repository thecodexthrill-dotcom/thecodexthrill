import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";
import { resolveAppOrigin } from "@/lib/app-origin";
import { classifyAuthLinkError } from "@/lib/supabase/auth-link-status";
import { isInvitationCallback, parseAuthCallbackParams } from "@/lib/supabase/auth-callback";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";
import { hasFreshInvitationSession, invitationHandoffMatches, invitationVerificationPage } from "@/lib/supabase/invitation-handoff";

type LinkStatus = "expired" | "used" | "invalid";
function classifyLinkError(code: string): LinkStatus { return classifyAuthLinkError(code); }
function statusRedirect(destination: string, origin: string, status: LinkStatus | "session-unavailable") {
  const target = destination === "/invite/accept"
    ? "/invite/accept?invite=" + (status === "session-unavailable" ? "invalid" : status)
    : destination === "/reset-password"
      ? "/reset-password?auth=" + (status === "invalid" ? "link-invalid" : status)
      : "/login?auth=" + (status === "session-unavailable" ? status : "link-invalid");
  const response = NextResponse.redirect(new URL(target, origin));
  if (destination === "/invite/accept") response.cookies.set("ctt_invite_verified", "", { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
function clearHandoffCookie(response: NextResponse, secure: boolean) {
  response.cookies.set("ctt_invite_handoff", "", { httpOnly: true, secure, sameSite: "lax", path: "/auth/callback", maxAge: 0 });
  return response;
}
function postStatusRedirect(origin: string, status: LinkStatus | "session-unavailable", secure: boolean) {
  return clearHandoffCookie(NextResponse.redirect(
    new URL("/invite/accept?invite=" + (status === "session-unavailable" ? "invalid" : status), origin),
    { status: 303, headers: { "cache-control": "no-store" } },
  ), secure);
}
function createSupabase(request: NextRequest, response: NextResponse) {
  const { url, key } = getSupabasePublicEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { code, tokenHash, otpType, next } = parseAuthCallbackParams(url.searchParams);
  const configuredBase = resolveAppOrigin(new URL("/", request.url).origin);
  if (!configuredBase) return NextResponse.json({ error: "The authentication callback base URL is invalid." }, { status: 500 });
  const callbackBase = new URL(request.url);
  const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const redirectBase = isLoopback(configuredBase.hostname) && isLoopback(callbackBase.hostname) && configuredBase.port === callbackBase.port ? callbackBase : configuredBase;
  const redirectOrigin = redirectBase.origin;
  const callbackError = url.searchParams.get("error_code") ?? url.searchParams.get("error");

  if (callbackError && (next === "/invite/accept" || next === "/reset-password")) {
    const status = classifyLinkError(callbackError);
    console.info("[auth.callback] provider rejected link", { destination: next, status });
    return statusRedirect(next, redirectOrigin, status);
  }

  // Email scanners may fetch links. Only the explicit same-origin POST below consumes an invite token.
  if (isInvitationCallback({ code, tokenHash, otpType, next }) && (tokenHash || code)) {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const response = new NextResponse(invitationVerificationPage(tokenHash ?? code!, nonce, tokenHash ? "token_hash" : "code"), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
    response.cookies.set("ctt_invite_handoff", nonce, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/auth/callback", maxAge: 300 });
    response.cookies.set("ctt_invite_verified", "", { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
  if (next === "/invite/accept" && !code && !tokenHash) return statusRedirect(next, redirectOrigin, "invalid");

  // Preserve the browser-only implicit fragment handoff for legacy recovery links.
  if (!code && !tokenHash && next === "/reset-password") {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const script = 'const target="/reset-password";const p=new URLSearchParams(window.location.hash.slice(1));if(p.has("error")||p.has("error_code")||p.has("error_description")){const c=(p.get("error_code")||p.get("error")||"").toLowerCase();const s=c.includes("expired")?"expired":c.includes("used")||c.includes("already")?"used":"invalid";window.location.replace(target+"?auth="+(s==="invalid"?"link-invalid":s))}else{window.location.replace(target+window.location.hash)}';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>Continue securely</title></head><body><p>Continuing securely...</p><script nonce="' + nonce + '">' + script + '</script></body></html>';
    const response = new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    response.headers.set("content-security-policy", "default-src 'none'; script-src 'nonce-" + nonce + "'; base-uri 'none'; frame-ancestors 'none'");
    return response;
  }

  const response = NextResponse.redirect(new URL(next, redirectOrigin));
  response.headers.set("cache-control", "no-store");
  const supabase = createSupabase(request, response);
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
  const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const user = userData.user;
  const sessionCookiePresent = response.cookies.getAll().some(({ name }) => /-auth-token(?:\.\d+)?$/.test(name));
  const sessionEstablished = sessionReturned && Boolean(user) && !userError && !claimsError && sessionCookiePresent;
  console.info("[auth.callback] session handoff", {
    flow,
    otpType: otpType ?? "code",
    sessionReturned,
    userVerified: Boolean(user) && !userError,
    sessionCookiePresent,
    sessionEstablished,
  });
  if (!sessionEstablished) return statusRedirect(next, redirectOrigin, "session-unavailable");
  if (isInvitationCallback({ code, tokenHash, otpType, next }) && user && hasAuthFlowMethod(claimsData?.claims?.amr, "invite")) {
    response.cookies.set("ctt_invite_verified", user.id, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 600 });
  }
  return response;
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secure = url.protocol === "https:";
  const form = await request.formData().catch(() => null);
  const cookieNonce = request.cookies.get("ctt_invite_handoff")?.value;
  const submittedNonce = form?.get("handoff");
  const sameOrigin = request.headers.get("origin") === origin;
  const tokenHash = form?.get("token_hash");
  const code = form?.get("code");
  const otpType = form?.get("type");
  const next = form?.get("next");
  if (!sameOrigin || otpType !== "invite" || next !== "/invite/accept"
    || !invitationHandoffMatches(cookieNonce, typeof submittedNonce === "string" ? submittedNonce : null)
    || (typeof tokenHash !== "string" && typeof code !== "string")
    || (typeof tokenHash === "string" && (tokenHash.length < 16 || tokenHash.length > 4096))
    || (typeof code === "string" && (code.length < 8 || code.length > 4096))) {
    return clearHandoffCookie(NextResponse.redirect(new URL("/invite/accept?invite=invalid", origin), { status: 303, headers: { "cache-control": "no-store" } }), secure);
  }

  const response = NextResponse.redirect(new URL("/invite/accept", origin), { status: 303, headers: { "cache-control": "no-store" } });
  const supabase = createSupabase(request, response);
  let verificationError: { code?: string; name?: string } | null = null;
  let sessionReturned = false;
  if (typeof tokenHash === "string") {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    verificationError = result.error;
    sessionReturned = Boolean(result.data.session);
  } else {
    const result = await supabase.auth.exchangeCodeForSession(code as string);
    verificationError = result.error;
    sessionReturned = Boolean(result.data.session);
  }
  response.cookies.set("ctt_invite_handoff", "", { httpOnly: true, secure, sameSite: "lax", path: "/auth/callback", maxAge: 0 });
  response.cookies.set("ctt_invite_verified", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  if (verificationError) {
    const status = classifyLinkError(verificationError.code ?? verificationError.name ?? "");
    console.info("[auth.callback] invitation verification failed", { flow: typeof tokenHash === "string" ? "token_hash" : "pkce_code", status });
    return postStatusRedirect(origin, status, secure);
  }
  const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const user = userData.user;
  const sessionCookiePresent = response.cookies.getAll().some(({ name }) => /-auth-token(?:\.\d+)?$/.test(name));
  if (!sessionReturned || !user || userError || claimsError || !sessionCookiePresent
    || !user.invited_at || !user.email_confirmed_at
    || !hasAuthFlowMethod(claimsData?.claims?.amr, "invite")
    || !hasFreshInvitationSession(user.id, claimsData?.claims?.sub, claimsData?.claims?.amr)) {
    console.info("[auth.callback] invitation session establishment failed", {
      sessionReturned,
      userVerified: Boolean(user) && !userError,
      sessionCookiePresent,
      claimsVerified: Boolean(claimsData?.claims?.sub) && !claimsError,
    });
    return postStatusRedirect(origin, "session-unavailable", secure);
  }
  response.cookies.set("ctt_invite_verified", user.id, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
