#!/usr/bin/env node
import nextEnv from "@next/env";
import { issueOwnerBootstrapToken } from "../src/lib/supabase/bootstrap-token.ts";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const appBase = process.env.APP_BASE_URL;
const email = process.env.OWNER_SUPER_ADMIN_EMAIL;
const signingSecret = process.env.OWNER_SUPER_ADMIN_TRANSFER_TOKEN;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !signingSecret) {
  console.error("Set OWNER_SUPER_ADMIN_EMAIL and OWNER_SUPER_ADMIN_TRANSFER_TOKEN in local .env.local.");
  process.exit(2);
}
let base;
try { base = new URL(appBase ?? ""); } catch {
  console.error("APP_BASE_URL must point to the local development app.");
  process.exit(2);
}
if (base.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(base.hostname) || base.port !== "3000") {
  console.error("Owner provisioning is restricted to http://localhost:3000 or http://127.0.0.1:3000.");
  process.exit(2);
}
let prompt;
if (stdin.isTTY) {
  prompt = createInterface({ input: stdin, output: stdout });
  const answer = (await prompt.question("Type TRANSFER to invite the configured owner and authorize the existing-slot transfer: ")).trim();
  prompt.close();
  if (answer !== "TRANSFER") { console.error("No invitation sent."); process.exit(2); }
} else {
  const input = await new Promise(resolve => { let data=""; stdin.setEncoding("utf8"); stdin.on("data", c => data += c); stdin.on("end", () => resolve(data)); });
  if (String(input).trim() !== "TRANSFER") { console.error("No invitation sent."); process.exit(2); }
}
let token;
try { token = issueOwnerBootstrapToken(signingSecret); } catch {
  console.error("Owner transfer signing configuration is invalid."); process.exit(2);
}
let response;
try {
  response = await fetch(new URL("/api/bootstrap/owner-transfer", base), {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}",
  });
} catch {
  console.error("Local owner invitation request failed to connect. The token was not printed."); process.exit(1);
}
const result = await response.json().catch(() => ({}));
console.log(`HTTP ${response.status}: ${result.message ?? result.error ?? "Request completed."}`);