import assert from "node:assert/strict";
import test from "node:test";

import { hasAuthFlowMethod, isSafeNextPath } from "./auth-flow.ts";

test("recognizes signed recovery and invitation AMR entries including GoTrue otp AMR", () => {
  assert.equal(hasAuthFlowMethod([{ method: "recovery", timestamp: 1 }], "recovery"), true);
  assert.equal(hasAuthFlowMethod([{ method: "invite", timestamp: 1 }], "invite"), true);
  assert.equal(hasAuthFlowMethod([{ method: "otp", timestamp: 1 }], "recovery"), true);
  assert.equal(hasAuthFlowMethod([{ method: "otp", timestamp: 1 }], "invite"), true);
});

test("rejects missing, malformed, or unrelated AMR claims", () => {
  assert.equal(hasAuthFlowMethod(undefined, "recovery"), false);
  assert.equal(hasAuthFlowMethod("recovery", "recovery"), false);
  assert.equal(hasAuthFlowMethod([{ method: "password" }], "recovery"), false);
  assert.equal(hasAuthFlowMethod([{ method: "invite" }], "recovery"), false);
});

test("isSafeNextPath allows valid platform deep-links and blocks open redirects", () => {
  // Valid deep-links
  assert.equal(isSafeNextPath("/admin/leads?id=11111111-2222-3333-4444-555555555555"), true);
  assert.equal(isSafeNextPath("/portal/files?section=contracts"), true);
  assert.equal(isSafeNextPath("/account/security"), true);
  assert.equal(isSafeNextPath("/bootstrap/initial"), true);
  assert.equal(isSafeNextPath("/admin"), true);
  assert.equal(isSafeNextPath("/portal"), true);

  // Dangerous open redirect payloads
  assert.equal(isSafeNextPath("https://malicious-site.com"), false);
  assert.equal(isSafeNextPath("//malicious-site.com"), false);
  assert.equal(isSafeNextPath("/\\malicious-site.com"), false);
  assert.equal(isSafeNextPath("javascript:alert(1)"), false);
  assert.equal(isSafeNextPath(""), false);
  assert.equal(isSafeNextPath(null), false);
  assert.equal(isSafeNextPath(undefined), false);
  assert.equal(isSafeNextPath("/random-unauthorized-root"), false);
});


