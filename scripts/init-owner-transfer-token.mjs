#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file = resolve(process.cwd(), ".env.local");
if (!existsSync(file)) { console.error("Run npm run supabase:start first so local .env.local exists."); process.exit(2); }
const current = readFileSync(file, "utf8");
if (/^OWNER_SUPER_ADMIN_TRANSFER_TOKEN=.+$/m.test(current)) { console.log("Owner transfer token is already configured; unchanged."); process.exit(0); }
const token = randomBytes(48).toString("base64url");
const updated = current.replace(/\s*$/, "") + `\nOWNER_SUPER_ADMIN_TRANSFER_TOKEN=${token}\n`;
writeFileSync(file, updated, { encoding: "utf8" });
console.log("Generated the owner transfer token in ignored .env.local; its value was not printed.");