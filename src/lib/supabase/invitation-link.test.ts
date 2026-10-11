import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyAuthLinkError } from "./auth-link-status.ts";

import { parseAuthCallbackParams } from "./auth-callback.ts";
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