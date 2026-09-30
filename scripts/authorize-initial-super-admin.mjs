#!/usr/bin/env node
import { createHmac, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const baseUrl = process.env.APP_BASE_URL;
const signingSecret = process.env.INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN;
if (!baseUrl || !signingSecret || Buffer.byteLength(signingSecret, "utf8") < 32) {
  console.error("Configure APP_BASE_URL and a 32-byte random INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN first.");
  process.exit(2);
}

let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  console.error("APP_BASE_URL is invalid.");
  process.exit(2);
}
if (parsedBase.protocol !== "https:" && parsedBase.hostname !== "127.0.0.1" && parsedBase.hostname !== "localhost") {
  console.error("APP_BASE_URL must use HTTPS outside local development.");
  process.exit(2);
}

let email;
let confirmation;
if (stdin.isTTY) {
  const prompt = createInterface({ input: stdin, output: stdout });
  email = (await prompt.question("Owner-approved administrator email: ")).trim();
  confirmation = (await prompt.question("Type INVITE to send this one-time invitation: ")).trim();
  prompt.close();
} else {
  let pipedInput = "";
  for await (const chunk of stdin) pipedInput += chunk;
  const [emailLine, confirmationLine] = pipedInput.split(/\r?\n/);
  email = (emailLine ?? "").trim();
  confirmation = (confirmationLine ?? "").trim();
  stdout.write("Owner-approved administrator email: " + email + "\n");
  stdout.write("Type INVITE to send this one-time invitation: " + confirmation + "\n");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || confirmation !== "INVITE") {
  console.error("No invitation sent.");
  process.exit(2);
}

const payload = Buffer.from(JSON.stringify({
  exp: Math.floor(Date.now() / 1000) + 15 * 60,
  nonce: randomBytes(32).toString("base64url"),
})).toString("base64url");
const signature = createHmac("sha256", signingSecret).update(payload).digest("base64url");
const token = payload + "." + signature;

let response;
try {
  response = await fetch(new URL("/api/bootstrap/initial", parsedBase), {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
} catch {
  console.error("Bootstrap request failed to connect. No token was printed.");
  process.exit(1);
}
const result = await response.json().catch(() => ({}));
console.log("HTTP " + response.status + ": " + (result.message ?? result.error ?? "Request completed."));
