// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const protectedTables = [
  "profiles", "user_roles", "streams", "stream_sources", "stream_ingest_secrets", "presence_sessions",
  "activity_events", "analytics_daily", "sponsors", "sponsor_impressions", "sponsor_clicks", "chat_rooms",
  "chat_messages", "chat_moderation_actions", "audit_logs", "app_settings",
  "chat_message_reports",
  "user_favorite_matches",
  "news",
  "live_sources",
  "live_source_webhook_events",
  "live_source_provider_cleanup_jobs",
];

async function readMigrationSet() {
  const dir = resolve("supabase/migrations");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(files.map(async (file) => ({
    file,
    sql: (await readFile(resolve(dir, file), "utf8"))
      .replace("create extension if not exists pgcrypto with schema extensions;", "-- pgcrypto is bundled by Supabase and unavailable in PGlite"),
  })));
}

describe("Supabase migrations", () => {
  it("executes the complete schema and RLS migrations on PostgreSQL", async () => {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb,
        raw_app_meta_data jsonb not null default '{}'::jsonb
      );
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    const migrations = await readMigrationSet();
    for (const migration of migrations) {
      await expect(db.exec(migration.sql), migration.file).resolves.toBeDefined();
    }
    const stabilization = migrations.find((migration) => migration.file === "20260628190000_security_and_streaming_stabilization.sql");
    await expect(db.exec(stabilization!.sql), "stabilization migration must be safe to resume").resolves.toBeDefined();
    const result = await db.query<{ count: number }>("select count(*)::int as count from pg_policies where schemaname = 'public'");
    expect(result.rows[0].count).toBeGreaterThanOrEqual(25);
    const image = "data:image/png;base64,aGVsbG8=";
    await db.query("insert into public.news (title, category, excerpt, image) values ($1, $2, $3, $4)", ["Final", "Resultado", "Resumen", image]);
    await db.query("insert into public.sponsors (name, image, alt_text) values ($1, $2, $3)", ["Patrocinador", image, "Logo del patrocinador"]);
    const persisted = await db.query<{ news_image: string; sponsor_image: string }>(`
      select
        (select image from public.news limit 1) as news_image,
        (select image from public.sponsors limit 1) as sponsor_image
    `);
    expect(persisted.rows[0]).toEqual({ news_image: image, sponsor_image: image });
    await expect(
      db.query(
        "insert into public.news (title, category, excerpt, is_sponsored, sponsor_name) values ($1, $2, $3, true, $4)",
        ["Contenido comercial", "Otro", "Resumen", "Marca Ejemplo"],
      ),
    ).resolves.toBeDefined();
    await expect(
      db.query("insert into public.news (title, category, excerpt, is_sponsored) values ($1, $2, $3, true)", ["Sin identificar", "Otro", "Resumen"]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.news (title, category, excerpt, image) values ($1, $2, $3, $4)", ["Ataque", "Otro", "No permitido", "data:image/svg+xml;base64,PHN2Zz4="]),
    ).rejects.toThrow();
    const catalogSchema = await db.query<{ has_match_id: boolean; has_external_id_index: boolean }>(`
      select
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'live_sources' and column_name = 'match_id'
        ) as has_match_id,
        exists (
          select 1 from pg_indexes
          where schemaname = 'public' and indexname = 'matches_external_id_active_idx'
        ) as has_external_id_index
    `);
    expect(catalogSchema.rows[0]).toEqual({ has_match_id: true, has_external_id_index: true });
    await db.close();
  }, 20_000);

  it("enables RLS on every sensitive table", async () => {
    // RLS is spread across multiple migration files — read all of them
    const allMigrations = await readMigrationSet();
    const sql = allMigrations.map((m) => m.sql).join("\n");
    for (const table of protectedTables) {
      expect(sql, `Expected RLS to be enabled on public.${table}`).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("uses cached auth.uid calls and closes security-definer search paths", async () => {
    const sql = await readFile(resolve("supabase/migrations/20260621113100_auth_and_rls.sql"), "utf8");
    expect(sql).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(sql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("removes direct access to protected profile, chat, metrics, and live-source data", async () => {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb,
        raw_app_meta_data jsonb not null default '{}'::jsonb
      );
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    for (const migration of await readMigrationSet()) await db.exec(migration.sql);

    const privileges = await db.query<{
      profile_status_update: boolean;
      profile_display_update: boolean;
      chat_update: boolean;
      metrics_execute: boolean;
      raw_sources_select: boolean;
      delete_rpc_execute: boolean;
    }>(`
      select
        has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE') as profile_status_update,
        has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') as profile_display_update,
        has_table_privilege('authenticated', 'public.chat_messages', 'UPDATE') as chat_update,
        has_function_privilege('authenticated', 'public.metrics_overview(timestamptz,timestamptz)', 'EXECUTE') as metrics_execute,
        has_table_privilege('authenticated', 'public.live_sources', 'SELECT') as raw_sources_select,
        has_function_privilege('authenticated', 'public.delete_own_chat_message(uuid)', 'EXECUTE') as delete_rpc_execute
    `);
    expect(privileges.rows[0]).toEqual({
      profile_status_update: false,
      profile_display_update: true,
      chat_update: false,
      metrics_execute: false,
      raw_sources_select: false,
      delete_rpc_execute: true,
    });
    await db.close();
  }, 20_000);
});
