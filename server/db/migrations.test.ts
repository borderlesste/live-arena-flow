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
  "live_sources",
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
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb,
        raw_app_meta_data jsonb not null default '{}'::jsonb
      );
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    for (const migration of await readMigrationSet()) {
      await expect(db.exec(migration.sql), migration.file).resolves.toBeDefined();
    }
    const result = await db.query<{ count: number }>("select count(*)::int as count from pg_policies where schemaname = 'public'");
    expect(result.rows[0].count).toBeGreaterThanOrEqual(25);
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
});
