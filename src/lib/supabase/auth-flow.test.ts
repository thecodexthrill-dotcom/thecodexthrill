import assert from "node:assert/strict";
import test from "node:test";

import { hasAuthFlowMethod } from "./auth-flow.ts";

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


