import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const result = spawnSync(isWindows ? "docker.exe" : "docker", ["ps", "--format", "{{.Names}}\t{{.Status}}"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
});
if (result.error || result.status !== 0) {
  process.stderr.write("Docker Desktop is unavailable. Start its Linux engine, then retry.\n");
  process.exit(1);
}
const services = (result.stdout ?? "").split(/\r?\n/).filter((line) => line.startsWith("supabase_"));
process.stdout.write(services.length ? services.join("\n") + "\n" : "No local Supabase containers are running.\n");
process.stdout.write("Studio: http://127.0.0.1:54323\nAPI: http://127.0.0.1:54321\nPostgreSQL: 127.0.0.1:54322\n");