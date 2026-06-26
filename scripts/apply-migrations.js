/**
 * apply-migrations.js
 *
 * Applies the live_sources migration (and idempotency column) directly to
 * your Supabase project using the Management API.
 *
 * Usage:
 *   node scripts/apply-migrations.js
 *
 * Requirements in .env:
 *   SUPABASE_URL              https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY eyJ...
 *
 * The script reads the project ref from SUPABASE_URL and calls:
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 *
 * You need a Supabase Personal Access Token (PAT) for that endpoint.
 * Generate one at: https://app.supabase.com/account/tokens
 * Then either:
 *   - Set SUPABASE_ACCESS_TOKEN=<PAT> in .env, OR
 *   - Run with:  SUPABASE_ACCESS_TOKEN=<PAT> node scripts/apply-migrations.js
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s][^=\s]*)=(.*)$/s);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      // last-wins for duplicate keys
      result[key] = val;
    }
  }
  return result;
}

async function main() {
  let envExtra = {};
  try {
    const raw = await readFile(resolve(__dirname, "../.env"), "utf8");
    envExtra = parseEnvFile(raw);
  } catch { /* .env optional */ }
  const env = { ...envExtra, ...process.env };

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  const accessToken = env.SUPABASE_ACCESS_TOKEN || "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌  Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    process.exit(1);
  }

  // Extract project ref from URL: https://<ref>.supabase.co
  const refMatch = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch?.[1];

  console.log(`\n🔗  Proyecto Supabase: ${projectRef || "(desconocido)"}`);
  console.log(`🔑  Service role key: ...${serviceRoleKey.slice(-8)}\n`);

  // Read migrations sorted
  const migrationsDir = resolve(__dirname, "../supabase/migrations");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  console.log(`📂  ${files.length} archivos de migración encontrados.\n`);

  // We'll apply each migration using the Supabase REST postgres endpoint
  // The endpoint POST /rest/v1/ doesn't support raw SQL, but we can use
  // the pg_dump-based approach via Management API if we have a PAT.

  if (accessToken && projectRef) {
    // Use Management API (preferred)
    console.log("🔧  Usando Supabase Management API\n");
    await applyViaMgmtApi(files, migrationsDir, projectRef, accessToken);
  } else {
    // Fallback: print the SQL for manual copy-paste into Supabase SQL Editor
    console.log("⚠️  No se encontró SUPABASE_ACCESS_TOKEN.\n");
    console.log("   Para aplicar automáticamente, añade al .env:");
    console.log("   SUPABASE_ACCESS_TOKEN=<tu PAT de https://app.supabase.com/account/tokens>\n");
    console.log("─────────────────────────────────────────────────────────");
    console.log("   Alternativa: aplica estas migraciones manualmente en el SQL Editor de Supabase.\n");
    await printMigrations(files, migrationsDir);
  }
}

async function applyViaMgmtApi(files, migrationsDir, projectRef, accessToken) {
  let applied = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    const cleanSql = sql
      .replace("create extension if not exists pgcrypto with schema extensions;", "-- pgcrypto bundled by Supabase")
      .trim();

    process.stdout.write(`⚙️   ${file} ... `);

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: cleanSql }),
    });

    const body = await res.text();

    if (res.ok) {
      console.log("✅  aplicada");
      applied++;
    } else {
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
      const msg = parsed?.message || parsed?.error || body;
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate key") ||
        msg.includes("relation") && !msg.includes("does not exist")
      ) {
        console.log("⏭️   ya aplicada");
        skipped++;
      } else {
        console.log(`❌  ${msg.slice(0, 200)}`);
        errors++;
      }
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`✅  Aplicadas:    ${applied}`);
  console.log(`⏭️   Ya existían:  ${skipped}`);
  console.log(`❌  Errores:      ${errors}`);
  console.log(`────────────────────────────────\n`);

  if (errors > 0) {
    console.error("⚠️  Algunas migraciones fallaron. Revisa los errores arriba.");
    process.exit(1);
  }
}

async function printMigrations(files, migrationsDir) {
  // Only print the migrations that are likely pending (live_sources and idempotency)
  const pending = files.filter((f) => f.includes("live_sources"));
  if (pending.length === 0) {
    console.log("No se encontraron migraciones relacionadas con live_sources.\n");
    return;
  }
  for (const file of pending) {
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    console.log(`\n-- ════════════════════════════════════════════`);
    console.log(`-- Archivo: ${file}`);
    console.log(`-- ════════════════════════════════════════════`);
    console.log(sql);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
