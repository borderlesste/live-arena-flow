/**
 * run-migration.js
 *
 * Verifica si live_sources existe en Supabase y:
 * - Si ya existe → confirma que está todo OK.
 * - Si no existe → imprime el SQL exacto para pegar en el SQL Editor de Supabase.
 *
 * Usage:  node scripts/run-migration.js
 *
 * Para aplicar automáticamente sin abrir el dashboard, añade al .env:
 *   SUPABASE_ACCESS_TOKEN=<PAT de https://app.supabase.com/account/tokens>
 * y vuelve a ejecutar este script.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s][^=\s]*)=(.*)$/s);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

async function tryMgmtApi(projectRef, accessToken, sql, label) {
  process.stdout.write(`  ⚙️   ${label} via Management API ... `);
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.text();
    if (res.ok) { console.log("✅"); return true; }
    const msg = body.toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) { console.log("⏭️   ya existía"); return true; }
    console.log(`❌  HTTP ${res.status}: ${body.slice(0, 200)}`);
    return false;
  } catch (e) {
    console.log(`❌  ${e.message}`);
    return false;
  }
}

async function main() {
  let envExtra = {};
  try { envExtra = parseEnvFile(await readFile(resolve(__dirname, "../.env"), "utf8")); } catch { /* ok */ }
  const env = { ...envExtra, ...process.env };

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  const accessToken = env.SUPABASE_ACCESS_TOKEN || "";
  const projectRef = supabaseUrl.match(/([a-z0-9]+)\.supabase\.co/)?.[1] || "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌  Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    process.exit(1);
  }

  console.log(`\n🔗  Proyecto: ${projectRef}.supabase.co\n`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // ── 1. Check if live_sources already exists ────────────────────────────────
  console.log("🔍  Verificando si live_sources existe...");
  const { error: checkError } = await supabase.from("live_sources").select("id").limit(1);

  const tableExists = !checkError || !checkError.message.includes("does not exist") && !checkError.message.includes("schema cache");

  // ── 2. Check if idempotency_key column exists ──────────────────────────────
  let idempotencyExists = false;
  if (tableExists) {
    const { error: colError } = await supabase
      .from("live_sources")
      .select("idempotency_key")
      .limit(1);
    idempotencyExists = !colError || !colError.message.includes("column");
  }

  const needsTable = !tableExists;
  const needsIdempotency = tableExists && !idempotencyExists;

  if (!needsTable && !needsIdempotency) {
    console.log("✅  live_sources ya existe con todos los campos necesarios.\n");
    console.log("    El error 'schema cache' puede ser porque Supabase necesita");
    console.log("    unos segundos para actualizar su caché. Espera 30 segundos y recarga.\n");
    return;
  }

  // ── 3. Try Management API if PAT is available ──────────────────────────────
  if (accessToken && projectRef) {
    console.log("🔑  Usando Management API con SUPABASE_ACCESS_TOKEN\n");
    const migrations = [];
    if (needsTable) {
      migrations.push({
        label: "20260625200000_live_sources.sql",
        file: resolve(__dirname, "../supabase/migrations/20260625200000_live_sources.sql"),
      });
    }
    if (needsIdempotency) {
      migrations.push({
        label: "20260625210000_live_sources_idempotency.sql",
        file: resolve(__dirname, "../supabase/migrations/20260625210000_live_sources_idempotency.sql"),
      });
    }
    let ok = true;
    for (const { label, file } of migrations) {
      const sql = await readFile(file, "utf8");
      const result = await tryMgmtApi(projectRef, accessToken, sql, label);
      if (!result) ok = false;
    }
    if (ok) {
      console.log("\n✅  Migraciones aplicadas con éxito.\n");
    } else {
      console.error("\n⚠️  Alguna migración falló — sigue las instrucciones manuales abajo.\n");
      await printManual(needsTable, needsIdempotency);
    }
    return;
  }

  // ── 4. Print manual instructions ──────────────────────────────────────────
  console.log("⚠️  No se encontró SUPABASE_ACCESS_TOKEN.\n");
  await printManual(needsTable, needsIdempotency);
}

async function printManual(needsTable, needsIdempotency) {
  const migrations = [];
  if (needsTable) {
    migrations.push(resolve(__dirname, "../supabase/migrations/20260625200000_live_sources.sql"));
  }
  if (needsIdempotency) {
    migrations.push(resolve(__dirname, "../supabase/migrations/20260625210000_live_sources_idempotency.sql"));
  }

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  INSTRUCCIONES PARA APLICAR MANUALMENTE EN SUPABASE");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  1. Abre: https://supabase.com/dashboard/project/_/sql/new");
  console.log("     (reemplaza _ con tu project ref o abre el proyecto directamente)");
  console.log("");
  console.log("  2. Copia y pega el SQL de abajo y pulsa 'Run'.");
  console.log("");
  console.log("  O añade al .env:");
  console.log("     SUPABASE_ACCESS_TOKEN=<PAT de https://app.supabase.com/account/tokens>");
  console.log("  y vuelve a ejecutar: node scripts/run-migration.js");
  console.log("");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("  SQL A EJECUTAR:");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("");

  for (const file of migrations) {
    const sql = await readFile(file, "utf8");
    console.log(sql);
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
