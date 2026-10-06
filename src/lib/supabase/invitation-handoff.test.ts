import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hasFreshInvitationSession, invitationHandoffMatches, invitationVerificationPage } from "./invitation-handoff.ts";
import { isInvitationCallback, parseAuthCallbackParams } from "./auth-callback.ts";

const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
const acceptance = readFileSync("src/app/invite/accept/page.tsx", "utf8");
const actions = readFileSync("src/lib/supabase/actions.ts", "utf8");

test("prefetched invitation callback creates a user-click POST without consuming the OTP", () => {
  const html = invitationVerificationPage("token-hash", "a".repeat(32));
  assert.match(html, /method="post" action="\/auth\/callback"/);
  assert.match(html, /Continue to accept invitation/);
  assert.doesNotMatch(html, /onload=|auto-submit|verifyOtp/);
  const defer = callback.indexOf('isInvitationCallback({ code, tokenHash, otpType, next })');
  const verification = callback.indexOf('supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" })');
  assert.ok(defer >= 0 && verification > defer, "GET must defer OTP verification to the explicit POST");
  assert.match(callback, /request\.headers\.get\("origin"\) === origin/);
});

test("handoff nonce is required and must be an exact cookie match", () => {
  const nonce = "a".repeat(32);
  assert.equal(invitationHandoffMatches(nonce, nonce), true);
  assert.equal(invitationHandoffMatches(undefined, nonce), false);
  assert.equal(invitationHandoffMatches(nonce, null), false);
  assert.equal(invitationHandoffMatches("short", "short"), false);
  assert.equal(invitationHandoffMatches(nonce, "b".repeat(32)), false);
  assert.match(callback, /path: "\/auth\/callback", maxAge: 300/);
  assert.match(callback, /status: 303/);
});

test("existing sessions do not count as a fresh invitation callback", () => {
  const amr = [{ method: "invite" }];
  assert.equal(hasFreshInvitationSession(undefined, "user-1", amr), false);
  assert.equal(hasFreshInvitationSession("user-2", "user-1", amr), false);
  assert.equal(hasFreshInvitationSession("user-1", "user-1", [{ method: "password" }]), false);
  assert.equal(hasFreshInvitationSession("user-1", "user-1", amr), true);
  assert.match(acceptance, /hasFreshInvitationSession\(handoffSubject, claims\?\.sub, claims\?\.amr\)/);
  assert.match(actions, /hasFreshInvitationSession\(handoffSubject, claims\?\.sub, claims\?\.amr\)/);
});

test("invitation interstitial escapes token material before embedding it in HTML", () => {
  const html = invitationVerificationPage('"><script>alert(1)</script>', "a".repeat(32));
  assert.doesNotMatch(html, /value=""><script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("callback GET never verifies an invitation and the only OTP verification is behind the POST handoff check", () => {
  const route = readFileSync("src/app/auth/callback/route.ts", "utf8");
  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  const postHandler = route.slice(route.indexOf("export async function POST"));
  const inviteGet = getHandler.slice(getHandler.indexOf("isInvitationCallback({ code, tokenHash, otpType, next })"), getHandler.indexOf('if (next === "/invite/accept"'));
  assert.doesNotMatch(inviteGet, /auth\.verifyOtp\(/);
  assert.equal((postHandler.match(/auth\.verifyOtp\(/g) ?? []).length, 1);
  assert.ok(postHandler.indexOf("invitationHandoffMatches(") < postHandler.indexOf("auth.verifyOtp("));
  assert.ok(postHandler.indexOf("sameOrigin") < postHandler.indexOf("auth.verifyOtp("));
});

test("direct token-hash and Supabase code callbacks use the invitation handoff", () => {
  const direct = parseAuthCallbackParams(new URLSearchParams("type=invite&token_hash=opaque&next=%2Finvite%2Faccept"));
  const code = parseAuthCallbackParams(new URLSearchParams("code=opaque-code&next=%2Finvite%2Faccept"));
  const unrelated = parseAuthCallbackParams(new URLSearchParams("code=opaque-code&next=%2Fauth%2Fcontinue"));
  assert.equal(isInvitationCallback(direct), true);
  assert.equal(isInvitationCallback(code), true);
  assert.equal(isInvitationCallback(unrelated), false);
});