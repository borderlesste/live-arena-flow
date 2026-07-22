import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";
const npxBin = isWindows ? "npx.cmd" : "npx";

const checks = [
  ["Node runtime", "node", ["-e", "const major = Number(process.versions.node.split('.')[0]); if (major !== 24) { console.error(`Vercel usa Node 24.x; runtime local detectado: ${process.version}`); process.exit(1); } console.log(`Node ${process.version}`);"]],
  ["Dependencias vulnerables de producción", npmBin, ["audit", "--omit=dev", "--audit-level=high"]],
  ["Lint", npmBin, ["run", "lint"]],
  ["Typecheck app y servidor", npmBin, ["run", "typecheck"]],
  ["Tests unitarios e integración", npmBin, ["test"]],
  ["Build Next/Vercel", npmBin, ["run", "build"]],
  ["Playwright chromium", npxBin, ["playwright", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"]],
  ["Smoke E2E", npmBin, ["run", "test:e2e", "--", "smoke.spec.ts"]],
];

function run(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[release-gate] ${label}`);
    const usesWindowsCmd = isWindows && command.endsWith(".cmd");
    const child = spawn(
      usesWindowsCmd ? process.env.ComSpec || "cmd.exe" : command,
      usesWindowsCmd ? ["/d", "/s", "/c", command, ...args] : args,
    {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} falló${signal ? ` con señal ${signal}` : ` con código ${code}`}`));
    });
  });
}

for (const [label, command, args] of checks) {
  await run(label, command, args);
}

console.log("\n[release-gate] OK: validaciones críticas completadas.");
