/**
 * Muestra las fuentes OBS con sus claves y URLs actuales.
 * Usage: node scripts/show-obs-sources.js
 */
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=\s][^=\s]*)=(.*)$/s);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

function tryDecrypt(value, secretKey) {
  if (!value) return { key: null, method: "empty" };
  if (!value.startsWith("v1:")) return { key: value, method: "plaintext" };
  if (!secretKey) return { key: null, method: "encrypted_no_secret" };
  const parts = value.split(":");
  if (parts.length !== 4) return { key: null, method: "invalid_format" };
  const [, ivB64, tagB64, cipherB64] = parts;
  try {
    const key = createHash("sha256").update(secretKey).digest();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(cipherB64, "base64url");
    const d = createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    const plain = Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    return { key: plain, method: "aes-gcm" };
  } catch {
    return { key: null, method: "decrypt_failed_wrong_key" };
  }
}

async function main() {
  let envExtra = {};
  try { envExtra = parseEnvFile(await readFile(resolve(__dirname, "../.env"), "utf8")); } catch { /**/ }
  const env = { ...envExtra, ...process.env };

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  const streamSecretKey = env.STREAM_SECRET_KEY || "";

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("live_sources")
    .select("id, name, event_id, source_kind, stream_key_ciphertext, stream_key_last4, playback_url, ingest_url, status, is_enabled")
    .eq("source_kind", "obs")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) { console.error("Error:", error.message); process.exit(1); }

  console.log(`\n📋  ${data.length} fuentes OBS:\n`);
  for (const src of data) {
    const { key, method } = tryDecrypt(src.stream_key_ciphertext, streamSecretKey);
    console.log(`  ID:         ${src.id}`);
    console.log(`  Partido:    ${src.event_id}`);
    console.log(`  Nombre:     ${src.name}`);
    console.log(`  Status:     ${src.status} | enabled: ${src.is_enabled}`);
    console.log(`  Ingest URL: ${src.ingest_url ?? "(null)"}`);
    console.log(`  Playback:   ${src.playback_url ?? "(null)"}`);
    console.log(`  Key last4:  ${src.stream_key_last4 ?? "(null)"}`);
    console.log(`  Key cipher: ${src.stream_key_ciphertext?.slice(0, 30) ?? "(null)"}...`);
    console.log(`  Key decode: ${key ? `${key} [${method}]` : `FAILED [${method}]`}`);
    console.log();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
