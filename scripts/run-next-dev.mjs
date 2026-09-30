import { spawn } from "node:child_process";
import { resolve } from "node:path";

const env = { ...process.env };
delete env.DEBUG;

const nextCli = resolve(process.cwd(), "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, "dev"], {
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Could not start the Next.js development server:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
