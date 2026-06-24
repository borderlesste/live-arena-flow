import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = (packageName, relativeBin, fallback) => {
  const local = join(root, "node_modules", packageName, relativeBin);
  return existsSync(local)
    ? { command: process.execPath, args: [local] }
    : { command: fallback, args: [] };
};

const webPort = process.env.PORT || process.env.WEB_PORT || "8080";
const configuredApiOrigin = process.env.API_INTERNAL_URL ? new URL(process.env.API_INTERNAL_URL) : undefined;
const configuredApiPort = configuredApiOrigin?.hostname === "127.0.0.1" || configuredApiOrigin?.hostname === "localhost"
  ? configuredApiOrigin.port
  : undefined;
const apiPort = process.env.API_PORT || configuredApiPort || (webPort === "8787" ? "8788" : "8787");
const apiOrigin = `http://127.0.0.1:${apiPort}`;

const children = [];
let stopping = false;

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
    shell: false,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (stopping) return;
    stopping = true;
    console.error(`${name} exited${signal ? ` by ${signal}` : ` with code ${code ?? 0}`}`);
    for (const other of children) {
      if (other !== child && !other.killed) other.kill("SIGTERM");
    }
    process.exit(code ?? 1);
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const tsx = cli("tsx", join("dist", "cli.mjs"), "tsx");
const next = cli("next", join("dist", "bin", "next"), "next");

async function waitForApi() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiOrigin}/api/health`);
      if (response.ok) return;
      lastError = new Error(`API health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError instanceof Error ? lastError : new Error("API did not become healthy");
}

async function main() {
  start("api", tsx.command, [...tsx.args, "server/index.ts"], {
    API_PORT: apiPort,
    API_INTERNAL_URL: apiOrigin,
    HOST: process.env.API_HOST || "127.0.0.1",
  });
  await waitForApi();
  start("web", next.command, [...next.args, "start", "-p", webPort], {
    API_INTERNAL_URL: apiOrigin,
  });
  console.log(`Production services started: web=http://0.0.0.0:${webPort}, api=${apiOrigin}`);
}

main().catch((error) => {
  console.error(error);
  shutdown("SIGTERM");
  process.exit(1);
});
