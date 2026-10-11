import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyAuthLinkError } from "./auth-link-status.ts";

import { buildProxyAuthCallbackRedirect, parseAuthCallbackParams } from "./auth-callback.ts";
import { buildAuthCallbackUrl, invitationRedirectTo, passwordRecoveryRedirectTo } from "./invitation-link.ts";
import { invitationListFailureMessage, safeInvitationListErrorCode } from "./invitation-list-status.ts";

test("invitation token hash is read with invite type and the safe acceptance destination", () => {
  const params = new URLSearchParams("token_hash=opaque-hash&type=invite&next=%2Finvite%2Faccept");
  assert.deepEqual(parseAuthCallbackParams(params), {
    code: null,
    tokenHash: "opaque-hash",
    otpType: "invite",
    next: "/invite/accept",
  });
});

test("invite type without next defaults to invitation acceptance", () => {
  const params = new URLSearchParams("type=invite&token_hash=opaque-hash");
  assert.equal(parseAuthCallbackParams(params).next, "/invite/accept");
});

test("callback rejects unsupported OTP types and open redirect destinations", () => {
  const params = new URLSearchParams("type=unknown&token_hash=opaque-hash&next=https%3A%2F%2Fevil.example");
  assert.deepEqual(parseAuthCallbackParams(params), {
    code: null,
    tokenHash: "opaque-hash",
    otpType: null,
    next: "/auth/continue",
  });
});

test("recovery links keep their password-reset destination", () => {
  const params = new URLSearchParams("type=recovery&token_hash=opaque-hash");
  assert.equal(parseAuthCallbackParams(params).next, "/reset-password");
});

test("invitation redirect targets the canonical production callback with acceptance path", () => {
  assert.equal(
    invitationRedirectTo(new URL("https://thecodexthrill.com")),
    "https://thecodexthrill.com/auth/callback?next=%2Finvite%2Faccept",
  );
});

test("invitation redirect preserves an isolated Vercel preview origin", () => {
  assert.equal(
    invitationRedirectTo(new URL("https://thecodexthrill-git-fix.vercel.app")),
    "https://thecodexthrill-git-fix.vercel.app/auth/callback?next=%2Finvite%2Faccept",
  );
});

test("password recovery redirect targets the canonical callback with /reset-password destination", () => {
  assert.equal(
    passwordRecoveryRedirectTo(new URL("https://thecodexthrill.com")),
    "https://thecodexthrill.com/auth/callback?next=%2Freset-password",
  );
  assert.equal(
    buildAuthCallbackUrl(new URL("https://thecodexthrill.com"), {
      next: "/invite/accept",
      tokenHash: "sample_hash_123456",
      otpType: "invite",
    }),
    "https://thecodexthrill.com/auth/callback?next=%2Finvite%2Faccept&token_hash=sample_hash_123456&type=invite",
  );
});

test("parseAuthCallbackParams recovers token_hash and type when embedded inside next", () => {
  const params = new URLSearchParams("next=%2Finvite%2Faccept%3Ftoken_hash%3Dembedded_token%26type%3Dinvite");
  assert.deepEqual(parseAuthCallbackParams(params), {
    code: null,
    tokenHash: "embedded_token",
    otpType: "invite",
    next: "/invite/accept",
  });
});

test("an expired invite token is classified for the invitation error path", () => {
  const params = new URLSearchParams("type=invite&token_hash=opaque-hash");
  assert.equal(parseAuthCallbackParams(params).otpType, "invite");
  assert.equal(classifyAuthLinkError("otp_expired"), "expired");
  assert.equal(classifyAuthLinkError("otp_already_used"), "used");
});

test("invite creation and resend both call Supabase Admin with the canonical redirect builder", () => {
  const actions = readFileSync("src/lib/supabase/actions.ts", "utf8").replace(String.fromCharCode(0xfeff), "");
  assert.equal((actions.match(/invitationRedirectTo\(appBase\)/g) ?? []).length, 2);
  assert.match(actions, /admin\.auth\.admin\.inviteUserByEmail\(parsed\.data\.email, \{ redirectTo \}\)/);
  assert.match(actions, /admin\.auth\.admin\.inviteUserByEmail\(invitation\.email, \{ redirectTo \}\)/);
  assert.match(actions, /passwordRecoveryRedirectTo\(appBase\)/);
  assert.match(actions, /flowType:\s*"implicit"/);
});

test("42702 ambiguous column error has explicit remediation message and SQL migration fix", () => {
  assert.equal(safeInvitationListErrorCode("42702"), "42702");
  assert.match(invitationListFailureMessage("42702"), /reference 42702/i);
  const fixMigration = readFileSync("supabase/migrations/20261011140000_fix_invitation_rpc_and_otp_amr.sql", "utf8");
  assert.match(fixMigration, /update public\.platform_invitations as pi\s+set status = 'expired'/i);
  assert.match(fixMigration, /where pi\.status = 'pending' and pi\.expires_at <= statement_timestamp\(\)/i);
  assert.match(fixMigration, /@\.method == "otp"/);
});

test("root-redirected otp_expired recovery link is intercepted and routed to /auth/callback?next=/reset-password", () => {
  const strandedUrl = new URL(
    "https://thecodexthrill.com/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  );
  const redirected = buildProxyAuthCallbackRedirect(strandedUrl);
  assert.ok(redirected, "root URL with error_code=otp_expired must be intercepted");
  assert.equal(redirected.pathname, "/auth/callback");
  assert.equal(redirected.searchParams.get("next"), "/reset-password");
  assert.equal(redirected.searchParams.get("error_code"), "otp_expired");

  const parsed = parseAuthCallbackParams(redirected.searchParams);
  assert.equal(parsed.next, "/reset-password");
  assert.equal(classifyAuthLinkError(redirected.searchParams.get("error_code") ?? ""), "expired");
});

test("valid, expired, reused, and malformed recovery links resolve deterministically", () => {
  // Valid recovery link (token_hash + type=recovery, or legacy token + type=recovery)
  const validTokenHash = parseAuthCallbackParams(
    new URLSearchParams("token_hash=pkce_valid_hash&type=recovery&next=%2Freset-password"),
  );
  assert.deepEqual(validTokenHash, {
    code: null,
    tokenHash: "pkce_valid_hash",
    otpType: "recovery",
    next: "/reset-password",
  });

  const validLegacyToken = parseAuthCallbackParams(
    new URLSearchParams("token=legacy_recovery_token&type=recovery"),
  );
  assert.deepEqual(validLegacyToken, {
    code: null,
    tokenHash: "legacy_recovery_token",
    otpType: "recovery",
    next: "/reset-password",
  });

  // Root-redirected valid recovery code or token_hash
  const rootRecoveryToken = buildProxyAuthCallbackRedirect(
    new URL("https://thecodexthrill.com/?token_hash=pkce_valid_hash&type=recovery"),
  );
  assert.equal(rootRecoveryToken?.pathname, "/auth/callback");
  assert.equal(rootRecoveryToken?.searchParams.get("next"), "/reset-password");

  const rootPkceCode = buildProxyAuthCallbackRedirect(
    new URL("https://thecodexthrill.com/?code=d71f3b2a-0000-4000-8000-000000000001"),
  );
  assert.equal(rootPkceCode?.pathname, "/auth/callback");
  assert.equal(rootPkceCode?.searchParams.get("next"), "/reset-password");

  // Reused recovery link
  assert.equal(classifyAuthLinkError("otp_already_used"), "used");
  assert.equal(classifyAuthLinkError("flow_state_already_used"), "used");

  // Malformed / invalid recovery link
  assert.equal(classifyAuthLinkError("access_denied"), "invalid");
  assert.equal(classifyAuthLinkError("bad_code_verifier"), "invalid");

  // Clean homepage request is untouched
  assert.equal(buildProxyAuthCallbackRedirect(new URL("https://thecodexthrill.com/")), null);
});

test("proxy, SiteFrame, callback route, and RecoverySessionBridge protect against homepage strand and PKCE hash collision", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const bridge = readFileSync("src/components/auth/recovery-session-bridge.tsx", "utf8");
  const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");

  assert.match(proxy, /buildProxyAuthCallbackRedirect\(request\.nextUrl\)/);
  assert.match(proxy, /"\/"/);

  // RecoverySessionBridge must strip window.location.hash BEFORE calling createClient()
  // so @supabase/ssr createBrowserClient (flowType: 'pkce') never throws AuthPKCEGrantCodeExchangeError.
  const replaceStateIdx = bridge.indexOf("window.history.replaceState");
  const createClientIdx = bridge.indexOf("createClient()");
  assert.ok(
    replaceStateIdx > 0 && createClientIdx > replaceStateIdx,
    "RecoverySessionBridge must clear window.location.hash before calling createClient()",
  );

  // Callback route must redirect empty-hash /auth/callback?next=/reset-password to /reset-password?auth=link-invalid
  assert.match(callback, /window\.location\.replace\(target\+"\?auth=link-invalid"\)/);
});