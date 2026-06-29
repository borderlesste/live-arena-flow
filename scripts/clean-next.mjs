import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const workspace = resolve(process.cwd());
const target = resolve(workspace, ".next");

if (dirname(target) !== workspace || basename(target) !== ".next") {
  throw new Error(`Refusing to clean unexpected build directory: ${target}`);
}

await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
