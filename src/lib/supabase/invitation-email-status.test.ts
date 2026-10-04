import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { invitationEmailFailureMessage, safeInvitationEmailCode } from "./invitation-email-status.ts";

test("reports Supabase test SMTP recipient restrictions with the safe remediation", () => {
  assert.match(invitationEmailFailureMessage({ code: "email_address_not_authorized" }), /test email service/);
});

test("reports unconfigured SMTP and rate limits without exposing provider messages", () => {
  assert.match(invitationEmailFailureMessage({ code: "smtp_not_configured" }), /no production SMTP provider/);
  assert.match(invitationEmailFailureMessage({ status: 429 }), /rate-limited/);
  assert.doesNotMatch(invitationEmailFailureMessage({ code: "unknown", status: 500 }), /secret|token|recipient/i);
});

test("only logs a constrained Auth error code", () => {
  assert.equal(safeInvitationEmailCode("email_address_not_authorized"), "email_address_not_authorized");
  assert.equal(safeInvitationEmailCode("recipient@example.com?token=secret"), "unknown");
  assert.equal(safeInvitationEmailCode(undefined), "unknown");
});

test("invite email template uses the supplied callback with the hashed invite token", () => {
  const template = readFileSync("supabase/templates/invite.html", "utf8").replace(String.fromCharCode(0xfeff), "");
  assert.match(template, /href="{{ \.RedirectTo }}&amp;token_hash={{ \.TokenHash }}&amp;type=invite"/);
  assert.doesNotMatch(template, /\.SiteURL/);
});