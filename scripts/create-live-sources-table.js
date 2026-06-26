/**
 * create-live-sources-table.js
 *
 * Crea la tabla live_sources y sus políticas RLS directamente en Supabase.
 * Usa el endpoint de administración de Supabase con service_role key.
 *
 * Este script funciona sin Docker, sin psql, sin PAT de Management API.
 *
 * Usage:  node scripts/create-live-sources-table.js
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=\s][^=\s]*)=(.*)$/s);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

async function runSQL(supabaseUrl, key, sql) {
  // Supabase exposes a non-documented but stable DDL endpoint for service_role:
  // POST /pg/query  (available since Supabase v2)
  const endpoints = [
    `${supabaseUrl}/pg/query`,
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
  ];

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.status !== 404) {
      return { ok: res.ok, status: res.status, body: await res.text() };
    }
  }
  return { ok: false, status: 404, body: "no DDL endpoint found" };
}

async function main() {
  let envExtra = {};
  try { envExtra = parseEnvFile(await readFile(resolve(__dirname, "../.env"), "utf8")); } catch { /**/ }
  const env = { ...envExtra, ...process.env };

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";

  if (!supabaseUrl || !key) {
    console.error("❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const projectRef = supabaseUrl.match(/([a-z0-9]+)\.supabase\.co/)?.[1];
  console.log(`\n🔗  ${projectRef}.supabase.co\n`);

  // First check if the table already exists using the standard REST API
  console.log("🔍  Verificando estado de live_sources ...");
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/live_sources?select=id&limit=1`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  const checkBody = await checkRes.text();

  if (checkRes.ok) {
    console.log("✅  La tabla live_sources YA EXISTE y es accesible.\n");

    // Check idempotency_key column
    const colRes = await fetch(`${supabaseUrl}/rest/v1/live_sources?select=idempotency_key&limit=1`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (colRes.ok) {
      console.log("✅  Columna idempotency_key también existe.\n");
      console.log("🎉  Base de datos completamente configurada.\n");
      return;
    } else {
      console.log("⚠️  Falta la columna idempotency_key — añadiéndola...");
      const addColSQL = `alter table public.live_sources add column if not exists idempotency_key text unique;
create index if not exists live_sources_idempotency_key_idx on public.live_sources (idempotency_key) where idempotency_key is not null;`;
      const r = await runSQL(supabaseUrl, key, addColSQL);
      if (r.ok) { console.log("✅  Columna añadida.\n"); return; }
      console.log(`⚠️  No se pudo añadir automáticamente (${r.status}). Aplica manualmente:`);
      console.log(addColSQL + "\n");
      return;
    }
  }

  // Table doesn't exist — try to create it
  if (checkBody.includes("schema cache") || checkBody.includes("does not exist") || checkRes.status === 406 || checkRes.status === 404) {
    console.log("⚠️  La tabla NO existe. Intentando crearla...\n");

    const sql1 = await readFile(resolve(__dirname, "../supabase/migrations/20260625200000_live_sources.sql"), "utf8");
    const sql2 = await readFile(resolve(__dirname, "../supabase/migrations/20260625210000_live_sources_idempotency.sql"), "utf8");

    const r1 = await runSQL(supabaseUrl, key, sql1);
    const r2 = r1.ok ? await runSQL(supabaseUrl, key, sql2) : { ok: false };

    if (r1.ok) {
      console.log("✅  Tabla live_sources creada.");
      if (r2.ok) console.log("✅  Columna idempotency_key añadida.\n");
      console.log("🎉  Listo — recarga la página de administración.\n");
      return;
    }
  }

  // Fallback: generate SQL for manual copy-paste
  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("  No fue posible crear la tabla automáticamente.");
  console.log("  Aplica el SQL manualmente en el SQL Editor de Supabase:");
  console.log("  https://supabase.com/dashboard/project/" + (projectRef || "_") + "/sql/new");
  console.log("────────────────────────────────────────────────────────────────\n");

  const sql1 = await readFile(resolve(__dirname, "../supabase/migrations/20260625200000_live_sources.sql"), "utf8");
  const sql2 = await readFile(resolve(__dirname, "../supabase/migrations/20260625210000_live_sources_idempotency.sql"), "utf8");
  console.log("-- ═══ PASO 1: Crear tabla ═══════════════════════════════════════");
  console.log(sql1);
  console.log("\n-- ═══ PASO 2: Añadir columna idempotency_key ════════════════════");
  console.log(sql2);
}

main().catch((e) => { console.error(e); process.exit(1); });
