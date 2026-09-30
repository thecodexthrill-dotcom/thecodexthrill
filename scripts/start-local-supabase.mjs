import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = ["start", "-x", "realtime", "-x", "logflare", "-x", "vector", "-x", "edge-runtime", "-x", "imgproxy"];
const isWindows = process.platform === "win32";
const command = isWindows ? "supabase.cmd start -x realtime -x logflare -x vector -x edge-runtime -x imgproxy" : "supabase";
const cliArgs = isWindows ? [] : args;
const result = spawnSync(command, cliArgs, {
  encoding: "utf8",
  shell: isWindows,
  windowsHide: true,
  maxBuffer: 20 * 1024 * 1024,
});
const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
let metadata;
for (const line of stdout.split(/\r?\n/)) {
  if (!line.trim()) continue;
  if (line.trimStart().startsWith("{")) {
    try {
      const candidate = JSON.parse(line);
      if (candidate.API_URL && (candidate.PUBLISHABLE_KEY || candidate.ANON_KEY)) metadata = candidate;
    } catch {}
  }
  if (/PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY|ANON_KEY|JWT_SECRET|sb_secret_|sb_publishable_|"DB_URL"/i.test(line)) {
    process.stdout.write("[local credential metadata redacted]\n");
  } else {
    process.stdout.write(line + "\n");
  }
}
for (const line of stderr.split(/\r?\n/)) {
  if (!line.trim()) continue;
  if (/PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY|ANON_KEY|JWT_SECRET|sb_secret_|sb_publishable_|"DB_URL"/i.test(line)) {
    process.stderr.write("[local credential metadata redacted]\n");
  } else {
    process.stderr.write(line + "\n");
  }
}

if (result.error) {
  process.stderr.write("Could not start the Supabase CLI. Verify Docker Desktop is running.\n");
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const apiUrl = metadata?.API_URL;
const publishableKey = metadata?.PUBLISHABLE_KEY ?? metadata?.ANON_KEY;
const secretKey = metadata?.SECRET_KEY ?? metadata?.SERVICE_ROLE_KEY;
if (!apiUrl || !publishableKey || !secretKey || !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname)) {
  process.stderr.write("Local Supabase started but did not return valid loopback connection metadata; .env.local was not changed.\n");
  process.exit(1);
}

const envPath = join(process.cwd(), ".env.local");
const oldLines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
const replaced = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);
const kept = oldLines.filter((line) => {
  const name = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
  return !name || !replaced.has(name);
});
const quote = (value) => '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
const envLines = [
  ...kept.filter((line) => line.length > 0),
  "NEXT_PUBLIC_SUPABASE_URL=" + quote(apiUrl),
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" + quote(publishableKey),
  "SUPABASE_SECRET_KEY=" + quote(secretKey),
];
if (!envLines.some((line) => /^APP_BASE_URL\s*=/.test(line))) envLines.push('APP_BASE_URL="http://127.0.0.1:3000"');
writeFileSync(envPath, envLines.join("\r\n") + "\r\n", { mode: 0o600 });
process.stdout.write("Wrote local-only Supabase connection settings to ignored .env.local (values hidden).\n");
