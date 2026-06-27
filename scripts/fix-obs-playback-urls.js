/**
 * fix-obs-playback-urls.js
 *
 * Recalcula playback_url e ingest_url de todas las fuentes OBS en Supabase
 * usando los valores actuales de STREAM_PLAYBACK_BASE_URL y STREAM_INGEST_URL.
 *
 * Soporta claves tanto en texto plano como cifradas con AES-256-GCM.
 *
 * Usage: node scripts/fix-obs-playback-urls.js
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

function extractStreamKey(ciphertext, secretKey) {
  if (!ciphertext) return null;
  // If not encrypted (created without STREAM_SECRET_KEY), the value IS the key
  if (!ciphertext.startsWith("v1:")) return ciphertext;
  if (!secretKey) return null;
  const parts = ciphertext.split(":");
  if (parts.length !== 4) return null;
  const [, ivB64, tagB64, cipherB64] = parts;
  try {
    const key = createHash("sha256").update(secretKey).digest();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(cipherB64, "base64url");
    const d = createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function main() {
  let envExtra = {};
  try { envExtra = parseEnvFile(await readFile(resolve(__dirname, "../.env"), "utf8")); } catch { /**/ }
  const env = { ...envExtra, ...process.env };

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  const streamSecretKey = env.STREAM_SECRET_KEY || "";
  const playbackBase = (env.STREAM_PLAYBACK_BASE_URL || "").replace(/\/$/, "");
  const ingestBase = (env.STREAM_INGEST_URL || "").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey) {
    console.error("❌  Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1);
  }
  if (!playbackBase) {
    console.error("❌  Falta STREAM_PLAYBACK_BASE_URL en .env"); process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log(`\n🔗  ${supabaseUrl.match(/([a-z0-9]+)\.supabase\.co/)?.[1]}.supabase.co`);
  console.log(`📺  Nueva playback base: ${playbackBase}`);
  console.log(`📡  Nuevo ingest URL:    ${ingestBase || "(sin cambio)"}\n`);

  const { data: sources, error } = await supabase
    .from("live_sources")
    .select("id, name, event_id, source_kind, stream_key_ciphertext, stream_key_last4, playback_url, ingest_url")
    .eq("source_kind", "obs")
    .is("deleted_at", null);

  if (error) { console.error("❌  Error:", error.message); process.exit(1); }
  if (!sources?.length) { console.log("ℹ️  No hay fuentes OBS."); return; }

  console.log(`📋  ${sources.length} fuentes OBS encontradas.\n`);

  let updated = 0, skipped = 0, failed = 0;

  for (const src of sources) {
    process.stdout.write(`  [${src.event_id}] ${src.name} (${src.id.slice(0, 8)}) ... `);

    const streamKey = extractStreamKey(src.stream_key_ciphertext, streamSecretKey);
    if (!streamKey) {
      console.log("⏭️   sin clave descifrable");
      skipped++;
      continue;
    }

    const newPlaybackUrl = `${playbackBase}/${streamKey}/index.m3u8`;
    const patch = {
      playback_url: newPlaybackUrl,
      updated_at: new Date().toISOString(),
    };
    if (ingestBase) patch.ingest_url = ingestBase;

    const { error: updateError } = await supabase
      .from("live_sources")
      .update(patch)
      .eq("id", src.id);

    if (updateError) {
      console.log(`❌  ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅  ${newPlaybackUrl}`);
      updated++;
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`✅  Actualizadas: ${updated}`);
  console.log(`⏭️   Omitidas:     ${skipped}`);
  console.log(`❌  Fallidas:      ${failed}`);
  console.log(`────────────────────────────────\n`);

  if (updated > 0) {
    console.log("⚠️  Reinicia el servidor backend para que los cambios surtan efecto.\n");
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
