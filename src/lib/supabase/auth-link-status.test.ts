import assert from "node:assert/strict";
import test from "node:test";

import { classifyAuthLinkError } from "./auth-link-status.ts";

test("classifies Supabase otp_expired recovery errors as expired", () => {
  assert.equal(classifyAuthLinkError("otp_expired"), "expired");
});

test("classifies used and unknown auth link errors without exposing provider details", () => {
  assert.equal(classifyAuthLinkError("otp_already_used"), "used");
  assert.equal(classifyAuthLinkError("invalid_token"), "invalid");
});