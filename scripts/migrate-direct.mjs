/**
 * migrate-direct.mjs
 * Aplica todas las migraciones pendientes directamente via conexión PostgreSQL.
 * Usage: node scripts/migrate-direct.mjs
 */

import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Intentamos múltiples hosts en orden
const HOSTS = [
  // Session mode pooler (IPv4, puerto 5432)
  // Set DATABASE_URL in .env to override — never hardcode credentials here
  "postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
];

const DATABASE_URL = process.env.DATABASE_URL || HOSTS[0];

async function main() {
  console.log("\n🔗  Conectando a Supabase...\n");

  // Try each host until one connects
  let client;
  let connectedUrl = "";
  for (const url of HOSTS) {
    const host = url.match(/@([^:]+)/)?.[1] || url;
    process.stdout.write(`   Probando ${host} ... `);
    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    try {
      await c.connect();
      console.log("✅  conectado");
      client = c;
      connectedUrl = url;
      break;
    } catch (e) {
      console.log(`❌  ${e.message.slice(0, 80)}`);
    }
  }

  if (!client) {
    console.error("\n❌  No se pudo conectar con ningún host.");
    console.error("   Verifica que la contraseña sea correcta y que tu IP no esté bloqueada.");
    console.error("   Puedes aplicar el SQL manualmente en:");
    console.error("   https://supabase.com/dashboard/project/ukjqoevmaamgtggrrmvp/sql/new\n");
    await printSQL();
    process.exit(1);
  }

  console.log(`\n✅  Conectado a: ${connectedUrl.replace(/:([^:@]+)@/, ':***@')}\n`);

  const migrationsDir = resolve(__dirname, "../supabase/migrations");
  const files = (await readdir(migrationsDir)).filter(f => f.endsWith(".sql")).sort();
  console.log(`📂  ${files.length} migraciones encontradas.\n`);

  let applied = 0, skipped = 0, errors = 0;

  for (const file of files) {
    let sql = await readFile(resolve(migrationsDir, file), "utf8");

    // pgcrypto ya está disponible en Supabase — comentar la línea de extensión
    sql = sql.replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "-- pgcrypto bundled by Supabase"
    );

    process.stdout.write(`⚙️   ${file} ... `);

    try {
      await client.query(sql);
      console.log("✅  aplicada");
      applied++;
    } catch (err) {
      const msg = err.message || "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        (msg.includes("relation") && msg.includes("already"))
      ) {
        console.log("⏭️   ya existía");
        skipped++;
      } else {
        console.log(`❌  ${msg.slice(0, 150)}`);
        errors++;
      }
    }
  }

  await client.end();

  console.log(`\n────────────────────────────────`);
  console.log(`✅  Aplicadas:    ${applied}`);
  console.log(`⏭️   Ya existían:  ${skipped}`);
  console.log(`❌  Errores:      ${errors}`);
  console.log(`────────────────────────────────\n`);

  if (errors > 0) {
    console.error("⚠️  Algunas migraciones fallaron.");
    process.exit(1);
  }

  console.log("🎉  Base de datos lista. Reinicia el servidor backend.\n");
}

async function printSQL() {
  const migrationsDir = resolve(__dirname, "../supabase/migrations");
  const pending = ["20260625200000_live_sources.sql", "20260625210000_live_sources_idempotency.sql"];
  console.log("\n── SQL PARA APLICAR MANUALMENTE ─────────────────────────────────────\n");
  for (const f of pending) {
    try {
      const sql = await readFile(resolve(migrationsDir, f), "utf8");
      console.log(`-- ${f}\n${sql}\n`);
    } catch { /**/ }
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
