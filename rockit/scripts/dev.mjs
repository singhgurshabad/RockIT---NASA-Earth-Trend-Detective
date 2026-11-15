// Start the two development services together; normalize common preview host flags.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const input = process.argv.slice(2), args = [];
let withApi = true;
for (let i = 0; i < input.length; i++) {
 if (input[i] === "--strictPort") continue;
 if (input[i] === "--without-api") { withApi = false; continue; }
 args.push(input[i] === "--host" ? "--hostname" : input[i]);
}
const root = resolve(process.cwd(), "..");
const localConfig = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const target = process.env.BACKEND_URL ?? localConfig.match(/^BACKEND_URL=(.+)$/m)?.[1]?.trim() ?? "http://127.0.0.1:8000";
const parsed = new URL(target);
const apiPort = parsed.port || "8000";
const venv = resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const python = process.env.ROCKIT_PYTHON ?? (existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3");
const children = [];
if (withApi) {
 if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("Use --without-api for an external BACKEND_URL.");
 children.push(spawn(python, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", apiPort], { cwd: resolve(root, "api"), stdio: "inherit" }));
}
children.push(spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...args], { stdio: "inherit", env: { ...process.env, BACKEND_URL: target } }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(c => { if (c.exitCode === null) c.kill("SIGTERM"); }); setTimeout(() => process.exit(code), 500); }
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => stop());
children.forEach(c => {
 c.on("error", error => { console.error("Could not start RockIT:", error.message, "Run python3 start.py from the project root to install dependencies."); stop(1); });
 c.on("exit", code => { if (!stopping) stop(code ?? 1); });
});
