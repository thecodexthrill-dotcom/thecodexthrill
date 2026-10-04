import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyAuthLinkError } from "./auth-link-status.ts";

import { parseAuthCallbackParams } from "./auth-callback.ts";
import { invitationRedirectTo } from "./invitation-link.ts";

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
});