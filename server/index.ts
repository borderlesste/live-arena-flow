import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { readStore, updateStore, type StoreData, type StoredUser, type StoredVideoSource } from "./store.js";
import { createSportsProvider, sportsProviderDiagnostics } from "./modules/sports/index.js";
import { CatalogBackedSportsProvider } from "./modules/sports/catalog-backed.provider.js";
import { SupabaseSportsCatalog } from "./modules/sports/sports-catalog.js";
import { hasSupabaseRole } from "./modules/auth/authorization.js";
import { selectSupabasePublicKey } from "./modules/auth/supabase-key.js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NewsArticle, StreamSource } from "../src/types/index.js";
import { embedUrlSchema, mediaUrlSchema } from "../src/schemas/stream.schema.js";
import { sponsorAdminSchema, type ManagedSponsor } from "../src/schemas/sponsor.schema.js";
import { isMissingSponsorColumn, sponsorColumns, sponsorFromRow, sponsorLegacyColumns, sponsorToLegacyRow, sponsorToRow, type SponsorRow } from "../src/schemas/sponsor.persistence.ts";
import { optionalPersistedImageSchema } from "../src/schemas/image.schema.js";
import { getLiveStreamProvider } from "./modules/streaming/index.js";
import { CloudflareStreamProvider, getCloudflareStreamConfig } from "./modules/streaming/cloudflare.provider.js";
import { RestreamProvider, getRestreamConfig } from "./modules/streaming/restream.provider.js";
import { RestreamCloudflareProvider } from "./modules/streaming/restream-cloudflare.provider.js";
import type { LiveStreamProvider } from "./modules/streaming/types.js";
import { buildWebhookEventKey, mapCloudflareEventToStatus, validateWebhookSecret } from "./modules/streaming/webhook.js";
import {
  cloudflareLiveWebhookSchema,
  createLiveSourceSchema,
  updateLiveSourceSchema,
  type LiveSourceStatus,
} from "../src/schemas/live-source.schema.js";
import { localMatchInputSchema } from "../src/schemas/local-match.schema.js";
import { authCredentialsSchema, authRegistrationSchema, displayNameKey, displayNameSchema } from "../src/schemas/auth.schema.js";
import {
  cloudflareBackfillStart,
  getCloudflareWebAnalyticsConfig,
  periodRange,
  summarizeWebAnalytics,
    playbackUrl: row.playback_url ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
  type StoredWebAnalyticsRow,
  type WebAnalyticsPeriod,
} from "./modules/analytics/web-analytics.js";

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN?.trim();
const STREAM_SECRET_KEY = process.env.STREAM_SECRET_KEY || "";
const LEGACY_AUTH_ENABLED = process.env.NODE_ENV !== "production" && process.env.LEGACY_AUTH_ENABLED !== "false";
const chatRateLimit = new Map<string, number>();
const sensitiveActionRateLimit = new Map<string, { count: number; resetAt: number }>();
const scryptAsync = promisify(scrypt);
const webAnalyticsPeriodSchema = z.enum(["day", "week", "month", "year"]);
const webAnalyticsSyncTimes = new Map<string, number>();
const webAnalyticsSyncPromises = new Map<string, Promise<{ synced: number }>>();
const sportsCatalog = canUseAdminSupabase() ? new SupabaseSportsCatalog(getAdminSupabaseClient()) : undefined;
const sportsProvider = new CatalogBackedSportsProvider(createSportsProvider(), sportsCatalog);
const VERSION = process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local";

interface StreamMetricAggregation {
  streamId: string;
  viewStarts: number;
  uniqueUsers: Set<string>;
  peakViewers: number;
  sumViewers: number;
  viewerSamples: number;
}

if (process.env.NODE_ENV === "production" && STREAM_SECRET_KEY.length < 32) {
  throw new Error("STREAM_SECRET_KEY must contain at least 32 characters in production");
}
if (process.env.NODE_ENV === "production" && (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || !selectSupabasePublicKey())) {
  throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in production");
}
if (process.env.NODE_ENV === "production" && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.SUPABASE_SECRET_KEY?.trim()) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production");
}

const configuredStreamProvider = (process.env.STREAM_PROVIDER || "custom").toLowerCase();
const usesCloudflareStream = ["cloudflare", "cloudflare_stream", "restream_cloudflare", "restream+cloudflare"].includes(configuredStreamProvider);
const usesRestream = ["restream", "restream_io", "restream_cloudflare", "restream+cloudflare"].includes(configuredStreamProvider);

// Validate every upstream used by the selected provider before accepting traffic.
if (usesCloudflareStream) {
  getCloudflareStreamConfig();
  if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    throw new Error("[startup] CLOUDFLARE_ACCOUNT_ID is required when STREAM_PROVIDER=cloudflare");
  }
  const cfToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!cfToken) {
    throw new Error("[startup] CLOUDFLARE_STREAM_API_TOKEN is required when STREAM_PROVIDER=cloudflare");
  }
  if (!process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim()) {
    console.warn("[startup] CLOUDFLARE_STREAM_CUSTOMER_CODE is not set — HLS playback URLs cannot be generated until it is configured.");
  }
  if (process.env.NODE_ENV === "production" && (process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("[startup] CLOUDFLARE_STREAM_WEBHOOK_SECRET must contain at least 32 characters in production");
  }
}

if (usesRestream) {
  getRestreamConfig();
}

function protectSecret(value: string): string {
  if (!STREAM_SECRET_KEY) return value;
  const key = createHash("sha256").update(STREAM_SECRET_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

const streamKindSchema = z.enum(["youtube", "youtube_live", "embed", "iframe", "mp4", "mp3", "hls", "obs_hls"]);
const streamPayloadBaseSchema = z.object({
  id: z.string().min(1),
  type: streamKindSchema,
  url: z.string().optional(),
  embedUrl: z.string().optional(),
  title: z.string().min(1).max(160),
  isExternal: z.boolean(),
  requiresConsent: z.boolean().optional(),
  provider: z.enum(["youtube", "tiktok", "vimeo", "custom"]).optional(),
  purpose: z.enum(["live", "highlight"]).optional(),
  obs: z.object({
    protocol: z.enum(["rtmp", "rtmps", "srt"]),
    serverUrl: z.string().optional().or(z.literal("")),
    streamKey: z.string().optional(),
  }).optional(),
});
function validateStreamPayload(source: z.infer<typeof streamPayloadBaseSchema>, ctx: z.RefinementCtx) {
  if (source.type === "obs_hls") {
    if (source.url) {
      const parsed = mediaUrlSchema.safeParse(source.url);
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL de media inválida", path: ["url"] });
    }
    return;
  }
  if (["hls", "mp4", "mp3"].includes(source.type)) {
    const parsed = mediaUrlSchema.safeParse(source.url);
    if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL de media inválida", path: ["url"] });
    return;
  }
  const parsed = embedUrlSchema.safeParse(source.embedUrl);
  if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL de embed inválida", path: ["embedUrl"] });
}
function validateObsIngest(source: z.infer<typeof streamPayloadBaseSchema>, ctx: z.RefinementCtx) {
  if (!source.obs || !source.obs.serverUrl) return;
  let parsed: URL;
  try {
    parsed = new URL(source.obs.serverUrl);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL de ingestión OBS inválida", path: ["obs", "serverUrl"] });
    return;
  }
  const protocol = parsed.protocol.replace(":", "");
  if (protocol !== source.obs.protocol) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El protocolo OBS debe coincidir con la URL de ingestión", path: ["obs", "serverUrl"] });
  }
}
const videoSourceSchema = streamPayloadBaseSchema.extend({
  matchId: z.string().min(1),
  createdAt: z.string(),
}).superRefine(validateStreamPayload).superRefine(validateObsIngest);
const managedStreamSchema = streamPayloadBaseSchema.superRefine(validateStreamPayload).superRefine(validateObsIngest);
const optionalHttpsUrlSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", "La URL debe usar HTTPS").optional().or(z.literal(""));
const newsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  excerpt: z.string().min(1).max(400),
  body: z.string().max(20000).optional(),
  image: optionalPersistedImageSchema,
  coverImageUrl: optionalHttpsUrlSchema,
  isSponsored: z.boolean().default(false),
  sponsorName: z.string().trim().min(1).max(120).optional(),
  publishedAt: z.string().datetime(),
  imageHue: z.number().int().min(0).max(360),
}).superRefine((article, context) => {
  if (article.isSponsored && !article.sponsorName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sponsorName"], message: "Indica el patrocinador del contenido" });
  }
  if (!article.isSponsored && article.sponsorName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sponsorName"], message: "El patrocinador solo aplica a contenido patrocinado" });
  }
});
const highlightSchema = z.object({ id: z.string(), title: z.string(), matchId: z.string().optional(), durationSec: z.number(), publishedAt: z.string(), imageHue: z.number(), kind: z.enum(["summary", "play", "clip", "interview", "replay"]) });
const chatSchema = z.object({ text: z.string().trim().min(1).max(280), channel: z.enum(["community", "official"]), clientId: z.string().min(1).max(80), displayName: z.string().min(1).max(40) });
const contactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(1).max(2000),
});
const credentialsSchema = authCredentialsSchema;
const registerSchema = authRegistrationSchema;
const profileSchema = z.object({
  displayName: displayNameSchema,
  preferences: z.object({ matchReminders: z.boolean() }),
}).strict();
const favoriteMatchIdSchema = z.string().trim().min(1).max(160);
const liveSourceIdSchema = z.string().uuid();
const brandAssetSchema = z.string().trim().min(1).max(500).refine((value) => value.startsWith("/") || URL.canParse(value), "Ruta de asset inválida");
const brandSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  logoPrimary: brandAssetSchema,
  logoDarkBackground: brandAssetSchema,
  logoLightBackground: brandAssetSchema,
  symbol: brandAssetSchema,
  symbolWhite: brandAssetSchema,
  favicon: brandAssetSchema,
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  hoverColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  darkColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  deepBackground: z.string().regex(/^#[0-9A-F]{6}$/i),
});

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function allowSensitiveAction(request: IncomingMessage, action: string, limit: number, windowMs: number): boolean {
  const credential = request.headers.authorization || request.socket.remoteAddress || "anonymous";
  const key = createHash("sha256").update(`${action}:${credential}`).digest("hex");
  const now = Date.now();
  const current = sensitiveActionRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    sensitiveActionRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

async function passwordHash(password: string, salt: string): Promise<string> {
  return Buffer.from(await scryptAsync(password, salt, 64) as ArrayBuffer).toString("hex");
}

async function passwordMatches(password: string, user: StoredUser): Promise<boolean> {
  const candidate = Buffer.from(await passwordHash(password, user.passwordSalt), "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function publicUser(user: StoredUser) {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safe } = user;
  return safe;
}

async function authenticatedUser(request: IncomingMessage) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return undefined;
  const store = await readStore();
  const session = store.sessions.find((item) => item.tokenHash === tokenHash(token) && new Date(item.expiresAt) > new Date());
  return session ? store.users.find((user) => user.id === session.userId) : undefined;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  await updateStore((store) => {
    store.sessions = store.sessions.filter((session) => new Date(session.expiresAt) > new Date() && session.userId !== userId);
    store.sessions.push({ id: crypto.randomUUID(), userId, tokenHash: tokenHash(token), expiresAt });
  });
  return token;
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (origin === APP_ORIGIN) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
}

function decryptSecret(value: string): string {
  if (!STREAM_SECRET_KEY) return value;
  if (!value || !value.startsWith("v1:")) return value;
  const parts = value.split(":");
  if (parts.length !== 4) return value;
  const [, ivB64, tagB64, cipherB64] = parts;
  try {
    const key = createHash("sha256").update(STREAM_SECRET_KEY).digest();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const cipherText = Buffer.from(cipherB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    console.error("Decryption failed");
    return "";
  }
}

async function logAudit(
  request: IncomingMessage,
  action: string,
  entityId: string,
  result: "success" | "denied" | "failure",
  before?: unknown,
  after?: unknown,
  entityType = "live_sources",
) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  let actorId: string | null = null;
  if (token && canUseAdminSupabase()) {
    try {
      const supa = getAdminSupabaseClient();
      const { data: userResult, error: userError } = await getAnonSupabaseClient().auth.getUser(token);
      if (!userError && userResult?.user) {
        actorId = userResult.user.id;
      }
    } catch {
      // ignore
    }
  }
  const userAgent = request.headers["user-agent"] || "";
  const ip = request.socket.remoteAddress || "";

  if (canUseAdminSupabase()) {
    try {
      const supa = getAdminSupabaseClient();
      await supa.from("audit_logs").insert({
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId.match(/^[0-9a-fA-F-]{36}$/) ? entityId : null,
        before_value: redactSensitive(before),
        after_value: redactSensitive(after),
        result,
        user_agent_summary: userAgent.slice(0, 255) || null,
        ip_hash: createHash("sha256").update(ip).digest("hex").slice(0, 64),
      });
    } catch {
      console.error("Failed to write audit log");
    }
  } else {
    console.info(`[AUDIT] Action: ${action}, Actor: ${actorId || "unknown"}, Entity: ${entityId}, Result: ${result}`);
  }
}

function redactSensitive(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(stream.?key|authorization|api.?token|secret|ciphertext|stream.?key.?iv)/i.test(key))
      .map(([key, entry]) => [key, redactSensitive(entry)]),
  );
}

interface LiveSourceRow {
  id: string;
  event_id: string;
  match_id?: string | null;
  name: string;
  source_kind: "manual" | "obs";
  usage_type: "live" | "highlight" | "prerecorded";
  playback_format: string;
  playback_url: string | null;
  playback_url_verified?: boolean;
  provider: string;
  provider_input_id: string | null;
  ingest_protocol: "rtmp" | "rtmps" | "srt" | null;
  ingest_url: string | null;
  stream_key_ciphertext: string | null;
  stream_key_iv: string | null;
  stream_key_last4: string | null;
  credentials_version: number;
  status: LiveSourceStatus;
  status_message: string | null;
  is_enabled: boolean;
  is_primary: boolean;
  recording_enabled: boolean;
  low_latency_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  last_provider_sync_at?: string | null;
  provider_error_code?: string | null;
  idempotency_key?: string | null;
  idempotency_fingerprint?: string | null;
}

function liveSourceFromRow(row: LiveSourceRow): StoredVideoSource {
  return {
    id: row.id,
    matchId: row.event_id,
    catalogMatchId: row.match_id ?? undefined,
    title: row.name,
    sourceKind: row.source_kind as "manual" | "obs",
    usageType: row.usage_type as "live" | "highlight" | "prerecorded",
    type: (row.source_kind === "obs" ? "obs_hls" : row.playback_format) as StoredVideoSource["type"],
    url: row.source_kind === "obs" ? undefined : row.playback_url ?? undefined,
    embedUrl: (["youtube", "youtube_live", "embed", "iframe"].includes(row.playback_format) ? row.playback_url ?? undefined : undefined),
    isExternal: ["youtube", "youtube_live", "embed", "iframe"].includes(row.playback_format),
    purpose: row.usage_type === "highlight" ? "highlight" : "live",
    provider: row.provider,
    playbackUrl: row.playback_url ?? undefined,
    playbackFormat: row.playback_format,
    playbackUrlVerified: row.playback_url_verified === true,
    providerInputId: row.provider_input_id ?? undefined,
    ingestProtocol: row.ingest_protocol ?? undefined,
    ingestUrl: row.ingest_url ?? undefined,
    streamKeyCiphertext: row.stream_key_ciphertext ?? undefined,
    streamKeyIv: row.stream_key_iv ?? undefined,
    streamKeyLast4: row.stream_key_last4 ?? undefined,
    credentialsVersion: row.credentials_version,
    status: row.status,
    statusMessage: row.status_message ?? undefined,
    isEnabled: row.is_enabled,
    isPrimary: row.is_primary,
    recordingEnabled: row.recording_enabled,
    lowLatencyEnabled: row.low_latency_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastConnectedAt: row.last_connected_at ?? undefined,
    lastDisconnectedAt: row.last_disconnected_at ?? undefined,
    lastProviderSyncAt: row.last_provider_sync_at ?? undefined,
    providerErrorCode: row.provider_error_code ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
    idempotencyFingerprint: row.idempotency_fingerprint ?? undefined,
    obs: row.source_kind === "obs" && row.ingest_protocol && row.ingest_url ? {
      protocol: row.ingest_protocol,
      serverUrl: row.ingest_url,
      streamKey: row.stream_key_ciphertext ?? undefined, // Store full ciphertext, revealSecret will decrypt it
    } : undefined,
  };
}

function liveSourceToRow(source: StoredVideoSource) {
  const playbackUrl = source.sourceKind === "manual" ? (source.url || source.embedUrl || "") : source.playbackUrl || "";
  const playbackFormat = source.sourceKind === "manual" ? source.type : "hls";
  return {
    id: source.id,
    event_id: source.matchId,
    match_id: source.catalogMatchId || null,
    name: source.title,
    source_kind: source.sourceKind || "manual",
    usage_type: source.usageType || (source.purpose === "highlight" ? "highlight" : "live"),
    playback_format: playbackFormat,
    playback_url: playbackUrl,
    playback_url_verified: source.playbackUrlVerified === true,
    provider: source.provider || "custom",
    provider_input_id: source.providerInputId || null,
    ingest_protocol: source.ingestProtocol || null,
    ingest_url: source.ingestUrl || null,
    stream_key_ciphertext: source.streamKeyCiphertext || null,
    stream_key_iv: source.streamKeyIv || null,
    stream_key_last4: source.streamKeyLast4 || null,
    credentials_version: source.credentialsVersion || 1,
    status: source.status || "ready",
    status_message: source.statusMessage || null,
    is_enabled: source.isEnabled !== false,
    is_primary: source.isPrimary === true,
    cover_image_url: source.coverImageUrl || null,
    recording_enabled: source.recordingEnabled === true,
    low_latency_enabled: source.lowLatencyEnabled === true,
    created_at: source.createdAt,
    updated_at: new Date().toISOString(),
    last_connected_at: source.lastConnectedAt || null,
    last_disconnected_at: source.lastDisconnectedAt || null,
    last_provider_sync_at: source.lastProviderSyncAt || null,
    provider_error_code: source.providerErrorCode || null,
    deleted_at: null,
    idempotency_key: source.idempotencyKey || null,
    idempotency_fingerprint: source.idempotencyFingerprint || null,
  };
}

function supabaseAuthConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    selectSupabasePublicKey(),
  );
}

function healthPayload() {
  const sports = sportsProviderDiagnostics();
  return {
    status: "ok",
    ok: true,
    service: "luis-romero-futbol-api",
    version: VERSION,
    database: canUseAdminSupabase() ? "configured" : "not_configured",
    auth: supabaseAuthConfigured() ? "supabase_configured" : LEGACY_AUTH_ENABLED ? "legacy_dev_enabled" : "not_configured",
    primarySportsProvider: sports.primaryProvider,
    sportsProviders: {
      sportsrc: sports.sportsSrcConfigured ? "configured" : "not_configured",
    },
  };
}

async function isAdmin(request: IncomingMessage): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && ADMIN_TOKEN && request.headers.authorization === `Bearer ${ADMIN_TOKEN}`) return true;
  return hasSupabaseRole(request, ["super_admin", "admin"]);
}

async function canManageLiveSources(request: IncomingMessage): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && ADMIN_TOKEN && request.headers.authorization === `Bearer ${ADMIN_TOKEN}`) return true;
  return hasSupabaseRole(request, ["super_admin", "admin", "stream_operator"]);
}

class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) {
    super(message);
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new RequestBodyError(400, "INVALID_JSON");
  }
}

function hasSafePlayback(source: StoredVideoSource): boolean {
  if (source.sourceKind !== "obs") return true;
  if (!source.playbackUrl) return false;
  try {
    const url = new URL(source.playbackUrl);
    if (url.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return source.provider !== "custom" || source.playbackUrlVerified === true;
}

function publicVideoSources(sources: StoredVideoSource[]) {
  const candidates = sources.filter((source) => source.isEnabled !== false && hasSafePlayback(source));
  const selectedByMatch = new Map<string, StoredVideoSource>();
  for (const source of candidates) {
    const selected = selectedByMatch.get(source.matchId);
    if (!selected || (source.isPrimary === true && selected.isPrimary !== true)) {
      selectedByMatch.set(source.matchId, source);
    }
  }

  return [...selectedByMatch.values()]
    .map(({ obs: _obs, streamKeyCiphertext: _cipher, streamKeyIv: _iv, ...source }) => {
      if (source.sourceKind === "obs") {
        return {
          ...source,
          // Expose playback URL for the public player; strip all ingest credentials
          url: source.playbackUrl || source.url || undefined,
          ingestUrl: undefined,
          ingestProtocol: undefined,
          streamKeyLast4: undefined,
          // Keep status and sourceKind so the mapper can promote match to live
          status: source.status,
          sourceKind: source.sourceKind,
        };
      }
      return source;
    });
}

function managedVideoSources(sources: StoredVideoSource[]) {
  return sources.map(sanitizeManagedSource);
}

function sanitizeManagedSource(source: StoredVideoSource) {
  const {
    streamKeyCiphertext: _ciphertext,
    streamKeyIv: _streamKeyIv,
    idempotencyKey: _idempotencyKey,
    idempotencyFingerprint: _idempotencyFingerprint,
    catalogMatchId: _catalogMatchId,
    ...safe
  } = source;
  const hasStreamKey = Boolean(source.streamKeyCiphertext || source.obs?.streamKey || source.provider === "cloudflare_stream");
  return {
    ...safe,
    obs: source.obs ? { ...source.obs, streamKey: undefined, hasStreamKey } : undefined,
    hasStreamKey,
  };
}

function providerForSource(source: StoredVideoSource): LiveStreamProvider {
  if (source.provider === "cloudflare_stream") return new CloudflareStreamProvider();
  if (source.provider === "restream") return new RestreamProvider();
  if (source.provider === "restream_cloudflare") return new RestreamCloudflareProvider();
  return getLiveStreamProvider();
}

function publicStreams(sources: StreamSource[]) {
  return sources.map(({ obs: _obs, ...source }) => source);
}

function managedStreams(sources: StreamSource[]) {
  return sources.map((source) => ({
    ...source,
    obs: source.obs ? { ...source.obs, streamKey: undefined, hasStreamKey: Boolean(source.obs.streamKey) } : undefined,
  }));
}

function sponsorColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${Math.abs(hash) % 360} 72% 52%`;
}

function sponsorMonogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function normalizeManagedSponsor(sponsor: Awaited<ReturnType<typeof readStore>>["sponsors"][number]): ManagedSponsor {
  return {
    id: sponsor.id,
    name: sponsor.name,
    image: sponsor.image,
    logoUrl: sponsor.logoUrl ?? "https://placehold.co/320x160/png",
    darkLogoUrl: sponsor.darkLogoUrl,
    altText: sponsor.altText ?? `Logo de ${sponsor.name}`,
    destinationUrl: sponsor.destinationUrl ?? sponsor.url,
    description: sponsor.description ?? sponsor.tagline,
    type: sponsor.type ?? sponsor.tier,
    status: sponsor.status ?? "active",
    priority: sponsor.priority ?? 0,
    startsAt: sponsor.startsAt,
    endsAt: sponsor.endsAt,
    devices: sponsor.devices ?? ["mobile", "tablet", "desktop", "tv"],
    position: sponsor.position ?? "homepage",
    campaign: sponsor.campaign,
    competitionId: sponsor.competitionId,
    matchId: sponsor.matchId,
    streamId: sponsor.streamId,
    utm: sponsor.utm ?? {},
    maxImpressions: sponsor.maxImpressions,
    maxClicks: sponsor.maxClicks,
  };
}

function managedSponsorsToPublic(sponsors: ManagedSponsor[]) {
  const now = Date.now();
  return sponsors
    .filter((sponsor) => sponsor.status === "active"
      && (!sponsor.startsAt || new Date(sponsor.startsAt).getTime() <= now)
      && (!sponsor.endsAt || new Date(sponsor.endsAt).getTime() > now))
    .sort((left, right) => right.priority - left.priority)
    .map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      tagline: sponsor.description,
      url: sponsor.destinationUrl,
      logoUrl: sponsor.image ?? sponsor.logoUrl,
      darkLogoUrl: sponsor.darkLogoUrl,
      altText: sponsor.altText,
      monogram: sponsorMonogram(sponsor.name),
      color: sponsorColor(sponsor.id),
      tier: sponsor.type,
    }));
}

function bearerSecretMatches(request: IncomingMessage, expected: string | undefined): boolean {
  if (!expected) return false;
  const received = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedDigest = createHash("sha256").update(expected).digest();
  const receivedDigest = createHash("sha256").update(received).digest();
  return timingSafeEqual(expectedDigest, receivedDigest);
}

async function maybeSyncWebAnalytics(start: string, end: string, force = false): Promise<{ synced: number }> {
  const config = getCloudflareWebAnalyticsConfig();
  if (!config) throw new Error("CLOUDFLARE_ANALYTICS_NOT_CONFIGURED");
  const cacheKey = `${start}:${end}`;
  if (!force && Date.now() - (webAnalyticsSyncTimes.get(cacheKey) ?? 0) < 10 * 60_000) return { synced: 0 };
  let syncPromise = webAnalyticsSyncPromises.get(cacheKey);
  if (!syncPromise) {
    syncPromise = syncCloudflareWebAnalytics(getAdminSupabaseClient(), config, start, end)
      .then((result) => {
        webAnalyticsSyncTimes.set(cacheKey, Date.now());
        return result;
      })
      .finally(() => { webAnalyticsSyncPromises.delete(cacheKey); });
    webAnalyticsSyncPromises.set(cacheKey, syncPromise);
  }
  return syncPromise;
}

async function webAnalyticsRows(start: string, end: string, siteTag?: string): Promise<StoredWebAnalyticsRow[]> {
  let query = getAdminSupabaseClient().from("web_analytics_daily")
    .select("day,hostname,visits,page_views,sample_interval,synced_at")
    .gte("day", start).lte("day", end).order("day", { ascending: true });
  if (siteTag) query = query.eq("site_tag", siteTag);
  const result = await query;
  if (result.error) throw result.error;
  return (result.data ?? []) as StoredWebAnalyticsRow[];
}

function publicSponsors(sponsors: Awaited<ReturnType<typeof readStore>>["sponsors"]) {
  return managedSponsorsToPublic(sponsors.map(normalizeManagedSponsor));
}

async function listPublicSponsorsPayload() {
  if (!canUseAdminSupabase()) return publicSponsors((await readStore()).sponsors);
  return managedSponsorsToPublic(await listManagedSponsorsPayload());
}

async function listManagedSponsorsPayload(): Promise<ManagedSponsor[]> {
  if (!canUseAdminSupabase()) return (await readStore()).sponsors.map(normalizeManagedSponsor);
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select(sponsorColumns)
    .is("deleted_at", null)
    .order("priority", { ascending: false });
  if (isMissingSponsorColumn(error)) {
    const fallback = await supabase
      .from("sponsors")
      .select(sponsorLegacyColumns)
      .is("deleted_at", null)
      .order("priority", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data as unknown as SponsorRow[]).map(sponsorFromRow);
  }
  if (error) throw error;
  return (data as unknown as SponsorRow[]).map(sponsorFromRow);
}

async function saveManagedSponsorPayload(sponsor: ManagedSponsor): Promise<ManagedSponsor[]> {
  if (!canUseAdminSupabase()) {
    const storedSponsor = {
      ...sponsor,
      tagline: sponsor.description,
      url: sponsor.destinationUrl,
      monogram: sponsorMonogram(sponsor.name),
      color: sponsorColor(sponsor.id),
      tier: sponsor.type,
    };
    const data = await updateStore((store) => {
      const index = store.sponsors.findIndex((item) => item.id === sponsor.id);
      if (index >= 0) store.sponsors[index] = storedSponsor;
      else store.sponsors.push(storedSponsor);
    });
    return data.sponsors.map(normalizeManagedSponsor);
  }
  const supabase = getAdminSupabaseClient();
  const { error } = await supabase
    .from("sponsors")
    .upsert(sponsorToRow(sponsor), { onConflict: "id" });
  if (isMissingSponsorColumn(error)) {
    if (sponsor.image) {
      throw new Error("La columna image de sponsors no está disponible. Ejecuta las migraciones de Supabase.");
    }
    const fallback = await supabase
      .from("sponsors")
      .upsert(sponsorToLegacyRow(sponsor), { onConflict: "id" });
    if (fallback.error) throw fallback.error;
    return listManagedSponsorsPayload();
  }
  if (error) throw error;
  return listManagedSponsorsPayload();
}

interface NewsRow {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body: string | null;
  image: string | null;
  cover_image_url: string | null;
  is_sponsored: boolean;
  sponsor_name: string | null;
  published_at: string;
  image_hue: number;
}

const newsColumns = "id,title,category,excerpt,body,image,cover_image_url,is_sponsored,sponsor_name,published_at,image_hue";

function newsFromRow(row: NewsRow): NewsArticle {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    body: row.body ?? undefined,
    image: row.image ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    isSponsored: row.is_sponsored,
    sponsorName: row.sponsor_name ?? undefined,
    publishedAt: row.published_at,
    imageHue: row.image_hue,
  };
}

function newsToRow(article: NewsArticle) {
  return {
    id: article.id,
    title: article.title,
    category: article.category,
    excerpt: article.excerpt,
    body: article.body ?? null,
    image: article.image ?? null,
    cover_image_url: article.coverImageUrl || null,
    is_sponsored: article.isSponsored === true,
    sponsor_name: article.isSponsored ? article.sponsorName?.trim() || null : null,
    published_at: article.publishedAt,
    image_hue: article.imageHue,
    deleted_at: null,
  };
}

async function listNewsPayload(includeUnpublished = false): Promise<NewsArticle[]> {
  if (!canUseAdminSupabase()) {
    const articles = (await readStore()).news.map((article) => ({
      ...article,
      isSponsored: article.isSponsored === true,
      sponsorName: article.isSponsored ? article.sponsorName : undefined,
    }));
    const now = Date.now();
    return articles
      .filter((article) => includeUnpublished || new Date(article.publishedAt).getTime() <= now)
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  }

  let query = getAdminSupabaseClient()
    .from("news")
    .select(newsColumns)
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  if (!includeUnpublished) query = query.lte("published_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as NewsRow[]).map(newsFromRow);
}

async function saveNewsPayload(article: NewsArticle): Promise<NewsArticle[]> {
  if (!canUseAdminSupabase()) {
    const data = await updateStore((store) => {
      const index = store.news.findIndex((item) => item.id === article.id);
      if (index >= 0) store.news[index] = article;
      else store.news.push(article);
    });
    return data.news.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  }
  const { error } = await getAdminSupabaseClient().from("news").upsert(newsToRow(article), { onConflict: "id" });
  if (error) throw error;
  return listNewsPayload(true);
}

async function deleteNewsPayload(id: string): Promise<NewsArticle[]> {
  if (!canUseAdminSupabase()) {
    const data = await updateStore((store) => { store.news = store.news.filter((item) => item.id !== id); });
    return data.news.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  }
  const { error } = await getAdminSupabaseClient().from("news")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return listNewsPayload(true);
}

async function deleteManagedSponsorPayload(id: string): Promise<ManagedSponsor[]> {
  if (!canUseAdminSupabase()) {
    const data = await updateStore((store) => { store.sponsors = store.sponsors.filter((item) => item.id !== id); });
    return data.sponsors.map(normalizeManagedSponsor);
  }
  const { error } = await getAdminSupabaseClient()
    .from("sponsors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (isMissingSponsorColumn(error)) throw new Error("La tabla sponsors no tiene todos los campos administrativos. Ejecuta las migraciones de Supabase.");
  if (error) throw error;
  return listManagedSponsorsPayload();
}

function getAdminSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin metrics");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function canUseAdminSupabase() {
  return Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));
}

/**
 * Returns true when a Supabase error indicates the live_sources table
 * has not been created yet (migration pending).
 */
function isLiveSourcesTableMissing(error: { message?: string; code?: string }): boolean {
  const msg = error.message || "";
  const code = error.code || "";
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("live_sources") ||
    code === "PGRST205" ||
    code === "42P01"
  );
}

/**
 * Reads live_sources from Supabase, falling back to the local store if
 * the table has not been created yet (migration pending).
 */
async function getAdminLiveSources(): Promise<StoredVideoSource[]> {
  if (!canUseAdminSupabase()) {
    return (await readStore()).videoSources;
  }
  const { data, error } = await getAdminSupabaseClient()
    .from("live_sources")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (isLiveSourcesTableMissing(error)) {
      console.warn("[live-sources] Tabla no encontrada — usando store local. Ejecuta la migración: supabase/migrations/20260625200000_live_sources.sql");
      return (await readStore()).videoSources;
    }
    throw error;
  }
  return data.map(liveSourceFromRow);
}

function getAnonSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = selectSupabasePublicKey();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureSupabaseProfile(request: IncomingMessage) {
  if (!canUseAdminSupabase()) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return undefined;
  const { data: userResult, error: userError } = await getAnonSupabaseClient().auth.getUser(token);
  if (userError || !userResult.user) return undefined;
  const user = userResult.user;
  const admin = getAdminSupabaseClient();
  const displayName = user.user_metadata.display_name || user.email?.split("@")[0] || "Usuario";
  const authProvider = user.app_metadata.provider || "email";
  await admin.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    avatar_url: user.user_metadata.avatar_url ?? null,
    auth_provider: authProvider,
  }, { onConflict: "id", ignoreDuplicates: true });
  await admin.from("user_roles").upsert({ user_id: user.id, role: "user" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  return { id: user.id, email: user.email ?? "", displayName };
}

async function adminUsersPayload() {
  if (!canUseAdminSupabase()) {
    const store = await readStore();
    return store.users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: "user",
      accountStatus: "active",
      provider: "legacy",
      createdAt: user.createdAt,
      lastLoginAt: null,
      lastActivityAt: null,
    }));
  }
  const supa = getAdminSupabaseClient();
  const [{ data: authUsers }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
    supa.auth.admin.listUsers({ page: 1, perPage: 200 }),
    supa.from("profiles").select("id,display_name,account_status,auth_provider,last_login_at,last_activity_at,created_at").order("created_at", { ascending: false }).limit(200),
    supa.from("user_roles").select("user_id,role"),
  ]);
  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;
  const emails = new Map((authUsers.users ?? []).map((user) => [user.id, user.email ?? ""]));
  const roleMap = new Map<string, string>();
  for (const role of roles ?? []) {
    const current = roleMap.get(role.user_id);
    if (!current || role.role === "super_admin" || (role.role === "admin" && current === "user")) roleMap.set(role.user_id, role.role);
  }
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    email: emails.get(profile.id) ?? "",
    displayName: profile.display_name,
    role: roleMap.get(profile.id) ?? "user",
    accountStatus: profile.account_status,
    provider: profile.auth_provider ?? "email",
    createdAt: profile.created_at,
    lastLoginAt: profile.last_login_at,
    lastActivityAt: profile.last_activity_at,
  }));
}

async function adminAuditPayload() {
  if (!canUseAdminSupabase()) return [];
  const { data, error } = await getAdminSupabaseClient()
    .from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,result,user_agent_summary,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

async function adminChatReportsPayload() {
  if (!canUseAdminSupabase()) return [];
  const supa = getAdminSupabaseClient();
  const { data: reports, error } = await supa
    .from("chat_message_reports")
    .select("id,message_id,reporter_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const messageIds = [...new Set((reports ?? []).map((report) => report.message_id))];
  const reporterIds = [...new Set((reports ?? []).map((report) => report.reporter_id))];
  const [{ data: messages }, { data: profiles }] = await Promise.all([
    messageIds.length ? supa.from("chat_messages").select("id,user_id,body,channel,created_at").in("id", messageIds) : Promise.resolve({ data: [] }),
    reporterIds.length ? supa.from("profiles").select("id,display_name").in("id", reporterIds) : Promise.resolve({ data: [] }),
  ]);
  const messageMap = new Map((messages ?? []).map((message) => [message.id, message]));
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return (reports ?? []).map((report) => ({
    ...report,
    reporterName: profileMap.get(report.reporter_id) ?? "Usuario",
    message: messageMap.get(report.message_id) ?? null,
  }));
}

async function handleCollection(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  collection: "sponsors" | "news" | "highlights",
  schema: z.ZodTypeAny,
) {
  const publicPath = `/api/${collection}`;
  const adminMatch = pathname.match(new RegExp(`^/api/admin/${collection}/([^/]+)$`));
  if (request.method === "GET" && pathname === publicPath) return json(response, 200, (await readStore())[collection]);
  if (!adminMatch) return false;
  if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
  if (request.method === "PUT") {
    const item = schema.parse(await readBody(request));
    const data = await updateStore((store) => {
      const list = store[collection] as Array<{ id: string }>;
      const index = list.findIndex((entry) => entry.id === adminMatch[1]);
      if (index >= 0) list[index] = item;
      else list.push(item);
    });
    return json(response, 200, data[collection]);
  }
  if (request.method === "DELETE") {
    const data = await updateStore((store) => {
      const record = store as unknown as Record<string, Array<{ id: string }>>;
      record[collection] = record[collection].filter((entry) => entry.id !== adminMatch[1]);
    });
    return json(response, 200, data[collection]);
  }
  return false;
}

const server = createServer(async (request, response) => {
  const requestId = typeof request.headers["x-request-id"] === "string"
    ? request.headers["x-request-id"].slice(0, 100)
    : crypto.randomUUID();
  response.setHeader("X-Request-Id", requestId);
  setCors(request, response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, healthPayload());
    if (request.method === "GET" && url.pathname === "/api/config/public") {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabasePublishableKey = selectSupabasePublicKey();
      if (!supabaseUrl || !supabasePublishableKey) {
        return json(response, 503, { error: "Supabase public configuration is unavailable" });
      }
      return json(response, 200, { supabaseUrl, supabasePublishableKey });
    }
    if (request.method === "GET" && url.pathname === "/api/brand") return json(response, 200, (await readStore()).brandSettings);
    if (request.method === "PUT" && url.pathname === "/api/admin/brand") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const brandSettings = brandSettingsSchema.parse(await readBody(request));
      await updateStore((store) => { store.brandSettings = brandSettings; });
      return json(response, 200, brandSettings);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/ensure-profile") {
      const profile = await ensureSupabaseProfile(request);
      return profile ? json(response, 200, profile) : json(response, 401, { error: "Sesión no válida" });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Auth" });
      const input = registerSchema.parse(await readBody(request));
      const email = input.email.toLowerCase();
      const salt = randomBytes(16).toString("hex");
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email,
        displayName: input.displayName,
        passwordSalt: salt,
        passwordHash: await passwordHash(input.password, salt),
        createdAt: new Date().toISOString(),
        preferences: { matchReminders: false },
      };
      let conflict: "email" | "displayName" | undefined;
      await updateStore((store) => {
        if (store.users.some((current) => current.email === email)) { conflict = "email"; return; }
        if (store.users.some((current) => displayNameKey(current.displayName) === displayNameKey(input.displayName))) { conflict = "displayName"; return; }
        store.users.push(user);
      });
      if (conflict === "email") return json(response, 409, { error: "Ya existe una cuenta con ese correo" });
      if (conflict === "displayName") return json(response, 409, { error: "Ese nombre visible ya está en uso" });
      return json(response, 201, { token: await createSession(user.id), user: publicUser(user) });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Auth" });
      const input = credentialsSchema.parse(await readBody(request));
      const user = (await readStore()).users.find((item) => item.email === input.email.toLowerCase());
      if (!user || !(await passwordMatches(input.password, user))) return json(response, 401, { error: "Correo o contraseña incorrectos" });
      return json(response, 200, { token: await createSession(user.id), user: publicUser(user) });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Auth" });
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token) await updateStore((store) => { store.sessions = store.sessions.filter((session) => session.tokenHash !== tokenHash(token)); });
      return json(response, 204, null);
    }

    if (request.method === "GET" && url.pathname === "/api/profile") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Auth" });
      const user = await authenticatedUser(request);
      return user ? json(response, 200, publicUser(user)) : json(response, 401, { error: "Sesión no válida" });
    }

    if (request.method === "PATCH" && url.pathname === "/api/profile") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Auth" });
      const user = await authenticatedUser(request);
      if (!user) return json(response, 401, { error: "Sesión no válida" });
      const input = profileSchema.parse(await readBody(request));
      let displayNameConflict = false;
      const data = await updateStore((store) => {
        const current = store.users.find((item) => item.id === user.id);
        if (store.users.some((item) => item.id !== user.id && displayNameKey(item.displayName) === displayNameKey(input.displayName))) {
          displayNameConflict = true;
          return;
        }
        if (current) { current.displayName = input.displayName; current.preferences = input.preferences; }
      });
      if (displayNameConflict) return json(response, 409, { error: "Ese nombre visible ya está en uso" });
      return json(response, 200, publicUser(data.users.find((item) => item.id === user.id)!));
    }

    if (request.method === "GET" && url.pathname === "/api/favorites/matches") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase para favoritos" });
      const user = await authenticatedUser(request);
      if (!user) return json(response, 401, { error: "Sesión inválida" });
      const favorites = (await readStore()).favoriteMatches
        .filter((item) => item.userId === user.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(({ externalMatchId, createdAt }) => ({ externalMatchId, createdAt }));
      return json(response, 200, favorites);
    }

    const favoriteMatch = url.pathname.match(/^\/api\/favorites\/matches\/([^/]+)$/);
    if (favoriteMatch && (request.method === "PUT" || request.method === "DELETE")) {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase para favoritos" });
      const user = await authenticatedUser(request);
      if (!user) return json(response, 401, { error: "Sesión inválida" });
      const externalMatchId = favoriteMatchIdSchema.parse(decodeURIComponent(favoriteMatch[1]));
      const data = await updateStore((store) => {
        store.favoriteMatches = store.favoriteMatches.filter((item) => item.userId !== user.id || item.externalMatchId !== externalMatchId);
        if (request.method === "PUT") store.favoriteMatches.push({ userId: user.id, externalMatchId, createdAt: new Date().toISOString() });
      });
      const stored = data.favoriteMatches.find((item) => item.userId === user.id && item.externalMatchId === externalMatchId);
      return json(response, 200, { externalMatchId, favorite: Boolean(stored), createdAt: stored?.createdAt });
    }

    if (request.method === "GET" && url.pathname === "/api/sports/events") return json(response, 200, { provider: sportsProvider.name, events: await sportsProvider.eventsByDate(url.searchParams.get("date") || new Date().toISOString().slice(0, 10)) });
    if (request.method === "GET" && url.pathname === "/api/sports/live") return json(response, 200, { provider: sportsProvider.name, events: await sportsProvider.liveEvents() });
    const eventMatch = url.pathname.match(/^\/api\/sports\/events\/([^/]+)$/);
    if (request.method === "GET" && eventMatch) return json(response, 200, { provider: sportsProvider.name, events: [await sportsProvider.eventById(eventMatch[1])].filter(Boolean) });

    if (request.method === "POST" && url.pathname === "/api/admin/local-matches") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      if (!sportsCatalog) return json(response, 503, { error: "El catálogo deportivo requiere Supabase" });
      if (!allowSensitiveAction(request, "create_local_match", 20, 60_000)) return json(response, 429, { error: "Demasiadas solicitudes" });
      const body = localMatchInputSchema.parse(await readBody(request));
      const event = await sportsCatalog.createLocalMatch(body);
      const internalId = await sportsCatalog.findMatchUuid(event.id) ?? event.id;
      await logAudit(request, "create_local_match", internalId, "success", null, event, "matches");
      return json(response, 201, { event });
    }

    if (request.method === "GET" && url.pathname === "/api/video-sources") {
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .is("deleted_at", null)
          .eq("is_enabled", true);
        if (error) return json(response, 500, { error: error.message });
        return json(response, 200, publicVideoSources(data.map(liveSourceFromRow)));
      } else {
        return json(response, 200, publicVideoSources((await readStore()).videoSources.filter((s) => s.isEnabled !== false)));
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/live-sources") {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        // Graceful fallback when the table doesn't exist yet (migration pending)
        if (error) {
          const isTableMissing = error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "PGRST205" || error.code === "42P01";
          if (isTableMissing) {
            console.warn("[live-sources] Tabla live_sources no encontrada en Supabase. Usando store local. Ejecuta la migración: supabase/migrations/20260625200000_live_sources.sql");
            const store = await readStore();
            return json(response, 200, managedVideoSources(store.videoSources));
          }
          return json(response, 500, { error: error.message });
        }
        return json(response, 200, managedVideoSources(data.map((row) => liveSourceFromRow(row as LiveSourceRow))));
      } else {
        const store = await readStore();
        return json(response, 200, managedVideoSources(store.videoSources));
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/live-sources/status") {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      
      let sourcesList: StoredVideoSource[] = [];
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .is("deleted_at", null);
        if (error) {
          const isTableMissing = error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "PGRST205" || error.code === "42P01";
          if (isTableMissing) {
            const store = await readStore();
            sourcesList = store.videoSources;
          } else {
            return json(response, 500, { error: error.message });
          }
        } else {
          sourcesList = data.map(liveSourceFromRow);
        }
      } else {
        const store = await readStore();
        sourcesList = store.videoSources;
      }

      const obsSources = sourcesList.filter((s) => s.sourceKind === "obs" && s.providerInputId);
      const statusPromises = obsSources.map(async (src) => {
        try {
          const provider = providerForSource(src);
          const status = await provider.getLiveInputStatus(src.providerInputId!);
          return { id: src.id, status };
        } catch {
          return { id: src.id, status: "provider_error" as const };
        }
      });
      
      const statuses = await Promise.all(statusPromises);
      
      for (const item of statuses) {
        const src = sourcesList.find((s) => s.id === item.id);
        if (src) {
          const syncedAt = new Date().toISOString();
          src.status = item.status;
          src.updatedAt = syncedAt;
          src.lastProviderSyncAt = syncedAt;
          if (item.status === "live") src.lastConnectedAt = syncedAt;
          if (item.status === "disconnected") src.lastDisconnectedAt = syncedAt;
          if (canUseAdminSupabase()) {
            await getAdminSupabaseClient().from("live_sources").update({
              status: item.status,
              updated_at: syncedAt,
              last_provider_sync_at: syncedAt,
              ...(item.status === "live" ? { last_connected_at: syncedAt } : {}),
              ...(item.status === "disconnected" ? { last_disconnected_at: syncedAt } : {}),
            }).eq("id", item.id);
          }
        }
      }

      if (!canUseAdminSupabase()) {
        await updateStore((store) => {
          statuses.forEach((item) => {
            const index = store.videoSources.findIndex((s) => s.id === item.id);
            if (index >= 0) store.videoSources[index].status = item.status;
          });
        });
      }

      return json(response, 200, statuses);
    }

    const credentialsRevealMatch = url.pathname.match(/^\/api\/admin\/live-sources\/([^/]+)\/credentials\/reveal$/);
    if (request.method === "POST" && credentialsRevealMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      if (!allowSensitiveAction(request, "reveal_credentials", 5, 60_000)) return json(response, 429, { error: "Demasiadas solicitudes" });
      const id = liveSourceIdSchema.parse(credentialsRevealMatch[1]);

      let currentSource: StoredVideoSource | undefined;
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (data) currentSource = liveSourceFromRow(data);
      } else {
        const store = await readStore();
        currentSource = store.videoSources.find((s) => s.id === id);
      }

      if (!currentSource) return json(response, 404, { error: "Fuente no encontrada" });
      if (currentSource.sourceKind !== "obs") return json(response, 400, { error: "Solo fuentes OBS" });

      let streamKey: string;
      let ingestUrl: string = currentSource.ingestUrl || "";
      let ingestProtocol: "rtmp" | "rtmps" | "srt" = (currentSource.ingestProtocol as "rtmps") || "rtmps";
      let relayDestination;

      // For Cloudflare provider: fetch credentials from Cloudflare API (preferred — no local plaintext storage)
      const provider = providerForSource(currentSource);
      if (["cloudflare_stream", "restream", "restream_cloudflare"].includes(currentSource.provider || "") && currentSource.providerInputId && provider.getCredentials) {
        try {
          const creds = await provider.getCredentials(currentSource.providerInputId);
          streamKey = creds.streamKey;
          ingestUrl = creds.ingestUrl;
          ingestProtocol = creds.ingestProtocol;
          relayDestination = creds.relayDestination;
        } catch {
          return json(response, 502, { error: { code: "STREAM_CREDENTIALS_FETCH_FAILED", message: "No se pudieron obtener las credenciales del proveedor." } });
        }
      } else {
        // Custom RTMP / legacy: decrypt from local storage
        const ciphertext = currentSource.streamKeyCiphertext || currentSource.obs?.streamKey || "";
        if (!ciphertext) return json(response, 404, { error: "Clave no encontrada" });
        streamKey = decryptSecret(ciphertext);
      }

      await logAudit(request, "reveal_credentials", id, "success");

      return json(response, 200, {
        ingestUrl,
        ingestProtocol,
        streamKey,
        ...(relayDestination ? { relayDestination } : {}),
      });
    }

    const credentialsRotateMatch = url.pathname.match(/^\/api\/admin\/live-sources\/([^/]+)\/credentials\/rotate$/);
    if (request.method === "POST" && credentialsRotateMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      if (!allowSensitiveAction(request, "rotate_credentials", 3, 60_000)) return json(response, 429, { error: "Demasiadas solicitudes" });
      const id = liveSourceIdSchema.parse(credentialsRotateMatch[1]);

      let currentSource: StoredVideoSource | undefined;
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (data) currentSource = liveSourceFromRow(data);
      } else {
        const store = await readStore();
        currentSource = store.videoSources.find((s) => s.id === id);
      }

      if (!currentSource) return json(response, 404, { error: "Fuente no encontrada" });
      if (currentSource.sourceKind !== "obs" || !currentSource.providerInputId) {
        return json(response, 400, { error: "Solo fuentes OBS con provider ID" });
      }

      const before = { ...currentSource };
      try {
        const provider = providerForSource(currentSource);
        const previousProviderInputId = currentSource.providerInputId;
        const isCloudflareBacked = ["cloudflare_stream", "restream_cloudflare"].includes(currentSource.provider || "");
        const replacement = isCloudflareBacked
          ? await provider.createLiveInput({
              name: currentSource.title,
              eventId: currentSource.matchId,
              sourceId: currentSource.id,
              recordingEnabled: currentSource.recordingEnabled,
              lowLatencyEnabled: currentSource.lowLatencyEnabled,
            })
          : provider.rotateCredentials
            ? { ...(await provider.rotateCredentials(previousProviderInputId)), providerInputId: previousProviderInputId, playbackUrl: currentSource.playbackUrl }
            : null;
        if (!replacement) return json(response, 501, { error: "No soportado por el proveedor" });

        const isReplacement = isCloudflareBacked;
        const nextVersion = (currentSource.credentialsVersion || 1) + 1;
        if (isReplacement && canUseAdminSupabase()) {
          const { data: replaced, error } = await getAdminSupabaseClient().rpc("replace_live_source_input", {
            p_source_id: id,
            p_expected_provider_input_id: previousProviderInputId,
            p_new_provider_input_id: replacement.providerInputId,
            p_new_ingest_url: replacement.ingestUrl,
            p_new_playback_url: replacement.playbackUrl,
            p_new_stream_key_last4: replacement.streamKey.slice(-4),
            p_new_credentials_version: nextVersion,
          });
          if (error || replaced !== true) {
            try { await provider.deleteLiveInput(replacement.providerInputId); } catch {
              await getAdminSupabaseClient().from("live_source_provider_cleanup_jobs").insert({
                source_id: id,
                provider: currentSource.provider,
                provider_input_id: replacement.providerInputId,
                reason: "create_compensation_failed",
              });
            }
            throw new Error("LIVE_INPUT_REPLACEMENT_PERSIST_FAILED");
          }
        }

        currentSource.providerInputId = replacement.providerInputId;
        currentSource.ingestUrl = replacement.ingestUrl;
        currentSource.playbackUrl = replacement.playbackUrl || undefined;
        currentSource.playbackUrlVerified = isReplacement ? Boolean(replacement.playbackUrl) : currentSource.playbackUrlVerified;
        currentSource.streamKeyLast4 = replacement.streamKey.slice(-4);
        currentSource.streamKeyCiphertext = isReplacement ? undefined : protectSecret(replacement.streamKey);
        currentSource.streamKeyIv = currentSource.streamKeyCiphertext?.startsWith("v1:")
          ? currentSource.streamKeyCiphertext.split(":")[1]
          : undefined;
        currentSource.credentialsVersion = (currentSource.credentialsVersion || 1) + 1;
        currentSource.status = "waiting_signal";
        currentSource.updatedAt = new Date().toISOString();

        if (canUseAdminSupabase() && !isReplacement) {
          const row = liveSourceToRow(currentSource);
          const { error } = await getAdminSupabaseClient().from("live_sources").update(row).eq("id", id);
          if (error) throw error;
        } else if (!canUseAdminSupabase()) {
          await updateStore((store) => {
            const index = store.videoSources.findIndex((s) => s.id === id);
            if (index >= 0) store.videoSources[index] = currentSource!;
          });
        }

        if (isReplacement) {
          try {
            await provider.deleteLiveInput(previousProviderInputId);
            if (canUseAdminSupabase()) {
              await getAdminSupabaseClient().from("live_source_provider_cleanup_jobs")
                .update({ status: "completed", updated_at: new Date().toISOString() })
                .eq("provider_input_id", previousProviderInputId)
                .eq("reason", "rotation");
            }
          } catch {
            // The transactional cleanup job created above remains pending.
          }
        }

        await logAudit(request, "rotate_credentials", id, "success", before, currentSource);
        return json(response, 200, {
          ingestUrl: currentSource.ingestUrl,
          ingestProtocol: currentSource.ingestProtocol,
          streamKey: replacement.streamKey,
          ...("relayDestination" in replacement && replacement.relayDestination
            ? { relayDestination: replacement.relayDestination }
            : {}),
        });
      } catch {
        await logAudit(request, "rotate_credentials", id, "failure", before, { code: "ROTATION_FAILED" });
        return json(response, 500, { error: "Error al rotar credenciales" });
      }
    }

    const liveSourceEnableMatch = url.pathname.match(/^\/api\/admin\/live-sources\/([^/]+)\/(enable|disable)$/);
    if (request.method === "POST" && liveSourceEnableMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      const id = liveSourceIdSchema.parse(liveSourceEnableMatch[1]);
      const action = liveSourceEnableMatch[2];
      const enable = action === "enable";

      let currentSource: StoredVideoSource | undefined;
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (data) currentSource = liveSourceFromRow(data);
      } else {
        const store = await readStore();
        currentSource = store.videoSources.find((s) => s.id === id);
      }

      if (!currentSource) return json(response, 404, { error: "Fuente no encontrada" });

      const before = { ...currentSource };
      if (currentSource.sourceKind === "obs" && currentSource.providerInputId) {
        try {
          const provider = providerForSource(currentSource);
          if (enable) await provider.enableLiveInput(currentSource.providerInputId);
          else await provider.disableLiveInput(currentSource.providerInputId);
        } catch {
          await logAudit(request, `${action}_live_source`, id, "failure", before, { code: "PROVIDER_UPDATE_FAILED" });
          return json(response, 502, { error: "No se pudo actualizar la entrada en el proveedor" });
        }
      }

      currentSource.isEnabled = enable;
      currentSource.status = enable ? "waiting_signal" : "disabled";
      currentSource.updatedAt = new Date().toISOString();

      if (canUseAdminSupabase()) {
        const { error } = await getAdminSupabaseClient().from("live_sources").update({ is_enabled: enable, status: currentSource.status, updated_at: currentSource.updatedAt }).eq("id", id);
        if (error) return json(response, 500, { error: error.message });
      } else {
        await updateStore((store) => {
          const index = store.videoSources.findIndex((s) => s.id === id);
          if (index >= 0) store.videoSources[index] = currentSource!;
        });
      }

      await logAudit(request, `${action}_live_source`, id, "success", before, currentSource);
      return json(response, 200, { success: true });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/live-sources") {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      if (!allowSensitiveAction(request, "create_live_source", 10, 60_000)) return json(response, 429, { error: "Demasiadas solicitudes" });
      const body = createLiveSourceSchema.parse(await readBody(request));
      const idempotencyKey = z.string().uuid().parse(request.headers["idempotency-key"]);
      const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
      const id = crypto.randomUUID();
      const isObs = body.sourceKind === "obs";
      const catalogMatchId = sportsCatalog ? await sportsCatalog.findMatchUuid(body.matchId) : undefined;
      if (body.matchId.startsWith("local-") && !catalogMatchId) return json(response, 400, { error: "El partido local no existe" });
      const newSource: StoredVideoSource = {
        id,
        matchId: body.matchId,
        catalogMatchId,
        title: body.title,
        sourceKind: isObs ? "obs" : "manual",
        usageType: body.usageType,
        type: isObs ? "obs_hls" : (body.playbackFormat || "hls") as StoredVideoSource["type"],
        isEnabled: body.isEnabled !== false,
        isPrimary: body.isPrimary === true,
        recordingEnabled: body.recordingEnabled === true,
        lowLatencyEnabled: body.lowLatencyEnabled === true,
        status: isObs ? "provisioning" : "ready",
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        coverImageUrl: body.coverImageUrl || undefined,
      };

      if (newSource.sourceKind === "manual") {
        newSource.playbackUrl = body.playbackUrl!;
        newSource.playbackUrlVerified = true;
        newSource.playbackFormat = body.playbackFormat || "hls";
        newSource.url = body.playbackUrl!;
        newSource.isExternal = ["youtube", "youtube_live", "embed", "iframe"].includes(newSource.type);
        if (newSource.isExternal) newSource.embedUrl = body.playbackUrl!;
      }

      if (canUseAdminSupabase()) {
        const supa = getAdminSupabaseClient();
        const { data: existing } = await supa
          .from("live_sources")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .is("deleted_at", null)
          .maybeSingle();
        if (existing) {
          if (existing.idempotency_fingerprint && existing.idempotency_fingerprint !== fingerprint) {
            return json(response, 409, { error: "La clave idempotente ya pertenece a otra solicitud" });
          }
          return json(response, 200, {
            source: sanitizeManagedSource(liveSourceFromRow(existing as LiveSourceRow)),
            replayed: true,
          });
        }

        const { error: insertError } = await supa.from("live_sources").insert(liveSourceToRow(newSource));
        if (insertError) {
          if (insertError.code === "23505") {
            const { data: raced } = await supa.from("live_sources").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
            if (raced?.idempotency_fingerprint === fingerprint) {
              return json(response, 200, {
                source: sanitizeManagedSource(liveSourceFromRow(raced as LiveSourceRow)),
                replayed: true,
              });
            }
            return json(response, 409, { error: "Conflicto de idempotencia" });
          }
          throw insertError;
        }
      } else {
        const reservation = await updateStore((data) => {
          if (!data.videoSources.some((source) => source.idempotencyKey === idempotencyKey)) {
            data.videoSources.push(newSource);
          }
        });
        const reserved = reservation.videoSources.find((source) => source.idempotencyKey === idempotencyKey)!;
        if (reserved.id !== id) {
          if (reserved.idempotencyFingerprint !== fingerprint) return json(response, 409, { error: "Conflicto de idempotencia" });
          return json(response, 200, { source: sanitizeManagedSource(reserved), replayed: true });
        }
      }

      if (!isObs) {
        await logAudit(request, "create_live_source", id, "success", null, newSource);
        return json(response, 201, { source: sanitizeManagedSource(newSource), replayed: false });
      }

      const provider = getLiveStreamProvider(body.ingestMode);
      let liveInput: Awaited<ReturnType<typeof provider.createLiveInput>>;
      try {
        liveInput = await provider.createLiveInput({
          name: newSource.title,
          eventId: newSource.matchId,
          sourceId: newSource.id,
          recordingEnabled: newSource.recordingEnabled,
          lowLatencyEnabled: newSource.lowLatencyEnabled,
        });
      } catch {
        if (canUseAdminSupabase()) {
          await getAdminSupabaseClient().from("live_sources").update({
            status: "provision_failed",
            provider_error_code: "LIVE_INPUT_CREATE_FAILED",
          }).eq("id", id);
        } else {
          await updateStore((data) => {
            const source = data.videoSources.find((item) => item.id === id);
            if (source) {
              source.status = "provision_failed";
              source.statusMessage = "LIVE_INPUT_CREATE_FAILED";
            }
          });
        }
        await logAudit(request, "create_live_source", id, "failure", null, { code: "LIVE_INPUT_CREATE_FAILED" });
        return json(response, 502, {
          error: {
            code: "LIVE_INPUT_CREATE_FAILED",
            message: "No fue posible crear la entrada de transmisión.",
            requestId,
          },
        });
      }

      newSource.provider = liveInput.provider;
      newSource.providerInputId = liveInput.providerInputId;
      newSource.ingestProtocol = liveInput.ingestProtocol;
      newSource.ingestUrl = liveInput.ingestUrl;
      newSource.playbackUrl = liveInput.playbackUrl || undefined;
      newSource.playbackUrlVerified = ["cloudflare_stream", "restream_cloudflare"].includes(liveInput.provider) && Boolean(liveInput.playbackUrl);
      newSource.playbackFormat = liveInput.playbackFormat;
      newSource.status = "waiting_signal";
      newSource.streamKeyLast4 = liveInput.streamKey.slice(-4);
      if (liveInput.provider !== "cloudflare_stream") {
        newSource.streamKeyCiphertext = protectSecret(liveInput.streamKey);
        if (newSource.streamKeyCiphertext.startsWith("v1:")) newSource.streamKeyIv = newSource.streamKeyCiphertext.split(":")[1];
      }

      try {
        if (canUseAdminSupabase()) {
          const row = liveSourceToRow(newSource);
          const { error } = await getAdminSupabaseClient().from("live_sources").update(row).eq("id", id).eq("status", "provisioning");
          if (error) throw error;
        } else {
          await updateStore((data) => {
            const index = data.videoSources.findIndex((item) => item.id === id);
            if (index >= 0) data.videoSources[index] = newSource;
          });
        }
      } catch {
        try {
          await provider.deleteLiveInput(liveInput.providerInputId);
        } catch {
          if (canUseAdminSupabase()) {
            await getAdminSupabaseClient().from("live_source_provider_cleanup_jobs").insert({
              source_id: id,
              provider: liveInput.provider,
              provider_input_id: liveInput.providerInputId,
              reason: "create_compensation_failed",
            });
          }
        }
        if (canUseAdminSupabase()) {
          await getAdminSupabaseClient().from("live_sources").update({
            status: "provider_error",
            provider_error_code: "LOCAL_PERSIST_FAILED",
          }).eq("id", id);
        }
        await logAudit(request, "create_live_source", id, "failure", null, { code: "LOCAL_PERSIST_FAILED" });
        return json(response, 500, { error: "Error al guardar la fuente" });
      }

      await logAudit(request, "create_live_source", id, "success", null, newSource);
      return json(response, 201, {
        source: sanitizeManagedSource(newSource),
        credentials: {
          ingestUrl: liveInput.ingestUrl,
          ingestProtocol: liveInput.ingestProtocol,
          streamKey: liveInput.streamKey,
        },
        ...(liveInput.relayDestination ? { relayDestination: liveInput.relayDestination } : {}),
        replayed: false,
      });
    }

    const liveSourceDetailMatch = url.pathname.match(/^\/api\/admin\/live-sources\/([^/]+)$/);
    if (request.method === "GET" && liveSourceDetailMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      const id = liveSourceIdSchema.parse(liveSourceDetailMatch[1]);
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (!data) return json(response, 404, { error: "Fuente no encontrada" });
        return json(response, 200, sanitizeManagedSource(liveSourceFromRow(data as LiveSourceRow)));
      } else {
        const store = await readStore();
        const src = store.videoSources.find((s) => s.id === id);
        if (!src) return json(response, 404, { error: "Fuente no encontrada" });
        return json(response, 200, sanitizeManagedSource(src));
      }
    }

    if (request.method === "PATCH" && liveSourceDetailMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      const id = liveSourceIdSchema.parse(liveSourceDetailMatch[1]);
      const body = updateLiveSourceSchema.parse(await readBody(request));

      let currentSource: StoredVideoSource | undefined;
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (data) currentSource = liveSourceFromRow(data);
      } else {
        const store = await readStore();
        currentSource = store.videoSources.find((s) => s.id === id);
      }

      if (!currentSource) return json(response, 404, { error: "Fuente no encontrada" });
      const before = { ...currentSource };

      if (body.title !== undefined) currentSource.title = body.title.trim();
      if (body.matchId !== undefined) {
        const catalogMatchId = sportsCatalog ? await sportsCatalog.findMatchUuid(body.matchId) : undefined;
        if (body.matchId.startsWith("local-") && !catalogMatchId) return json(response, 400, { error: "El partido local no existe" });
        currentSource.matchId = body.matchId;
        currentSource.catalogMatchId = catalogMatchId;
      }
      if (body.coverImageUrl !== undefined) currentSource.coverImageUrl = body.coverImageUrl || undefined;
      if (body.isPrimary !== undefined) currentSource.isPrimary = body.isPrimary === true;
      if (body.lowLatencyEnabled !== undefined) currentSource.lowLatencyEnabled = body.lowLatencyEnabled === true;
      if (body.recordingEnabled !== undefined) currentSource.recordingEnabled = body.recordingEnabled === true;
      if (body.playbackUrl !== undefined && currentSource.sourceKind === "manual") {
        currentSource.playbackUrl = body.playbackUrl;
        currentSource.url = body.playbackUrl;
        currentSource.isExternal = ["youtube", "youtube_live", "embed", "iframe"].includes(currentSource.type);
        if (currentSource.isExternal) currentSource.embedUrl = body.playbackUrl;
      } else if (body.playbackUrl !== undefined && currentSource.sourceKind === "obs" && currentSource.provider !== "cloudflare_stream") {
        const parsedUrl = new URL(body.playbackUrl);
        const storedKey = currentSource.streamKeyCiphertext || currentSource.obs?.streamKey;
        const rawKey = storedKey ? decryptSecret(storedKey) : "";
        if (parsedUrl.protocol !== "https:" || (rawKey && parsedUrl.pathname.includes(rawKey))) {
          return json(response, 400, { error: "La reproducción exige una URL HTTPS independiente de la clave de publicación" });
        }
        currentSource.playbackUrl = body.playbackUrl;
        currentSource.playbackUrlVerified = true;
      }

      if (
        body.lowLatencyEnabled !== undefined &&
        currentSource.sourceKind === "obs" &&
        currentSource.provider === "cloudflare_stream" &&
        currentSource.providerInputId
      ) {
        const provider = providerForSource(currentSource);
        if (!provider.updateLiveInput) {
          return json(response, 502, { error: "El proveedor no permite actualizar la baja latencia" });
        }
        try {
          await provider.updateLiveInput(currentSource.providerInputId, {
            lowLatencyEnabled: currentSource.lowLatencyEnabled === true,
          });
        } catch {
          return json(response, 502, { error: "No se pudo actualizar la baja latencia en Cloudflare" });
        }
      }
      currentSource.updatedAt = new Date().toISOString();

      if (currentSource.isPrimary) {
        if (canUseAdminSupabase()) {
          await getAdminSupabaseClient().from("live_sources").update({ is_primary: false }).eq("event_id", currentSource.matchId).neq("id", id);
        }
      }

      if (canUseAdminSupabase()) {
        const row = liveSourceToRow(currentSource);
        const { error } = await getAdminSupabaseClient().from("live_sources").update(row).eq("id", id);
        if (error) return json(response, 500, { error: error.message });
      } else {
        await updateStore((store) => {
          const index = store.videoSources.findIndex((s) => s.id === id);
          if (index >= 0) {
            if (currentSource!.isPrimary) {
              store.videoSources.forEach((s) => {
                if (s.matchId === currentSource!.matchId && s.id !== id) s.isPrimary = false;
              });
            }
            store.videoSources[index] = currentSource!;
          }
        });
      }

      await logAudit(request, "update_live_source", id, "success", before, currentSource);
      return json(response, 200, sanitizeManagedSource(currentSource));
    }

    if (request.method === "DELETE" && liveSourceDetailMatch) {
      if (!await canManageLiveSources(request)) return json(response, 403, { error: "No autorizado" });
      const id = liveSourceIdSchema.parse(liveSourceDetailMatch[1]);

      let currentSource: StoredVideoSource | undefined;
      if (canUseAdminSupabase()) {
        const { data, error } = await getAdminSupabaseClient()
          .from("live_sources")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) return json(response, 500, { error: error.message });
        if (data) currentSource = liveSourceFromRow(data);
      } else {
        const store = await readStore();
        currentSource = store.videoSources.find((s) => s.id === id);
      }

      if (!currentSource) return json(response, 404, { error: "Fuente no encontrada" });

      if (currentSource.sourceKind === "obs" && currentSource.providerInputId) {
        if (canUseAdminSupabase()) {
          await getAdminSupabaseClient().from("live_sources").update({ status: "deletion_pending" }).eq("id", id);
        } else {
          await updateStore((store) => {
            const source = store.videoSources.find((item) => item.id === id);
            if (source) source.status = "deletion_pending";
          });
        }
        try {
          await providerForSource(currentSource).deleteLiveInput(currentSource.providerInputId);
        } catch {
          if (canUseAdminSupabase()) {
            const supa = getAdminSupabaseClient();
            await supa.from("live_sources").update({
              status: "deletion_failed",
              provider_error_code: "LIVE_INPUT_DELETE_FAILED",
            }).eq("id", id);
            await supa.from("live_source_provider_cleanup_jobs").upsert({
              source_id: id,
              provider: currentSource.provider || "custom",
              provider_input_id: currentSource.providerInputId,
              reason: "delete_failed",
              status: "pending",
            }, { onConflict: "provider,provider_input_id,reason" });
          } else {
            await updateStore((store) => {
              const source = store.videoSources.find((item) => item.id === id);
              if (source) source.status = "deletion_failed";
            });
          }
          await logAudit(request, "delete_live_source", id, "failure", currentSource, { code: "LIVE_INPUT_DELETE_FAILED" });
          return json(response, 502, { error: "El proveedor no confirmó la eliminación; la fuente sigue visible para reintentar" });
        }
      }

      if (canUseAdminSupabase()) {
        const { error } = await getAdminSupabaseClient().from("live_sources").update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) return json(response, 500, { error: error.message });
      } else {
        await updateStore((store) => {
          store.videoSources = store.videoSources.filter((s) => s.id !== id);
        });
      }

      await logAudit(request, "delete_live_source", id, "success", currentSource, null);
      return json(response, 200, { success: true });
    }
    if (request.method === "GET" && url.pathname === "/api/streams") return json(response, 200, publicStreams((await readStore()).streams));
    if (request.method === "GET" && url.pathname === "/api/admin/video-sources") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, managedVideoSources((await readStore()).videoSources));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/streams") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, managedStreams((await readStore()).streams));
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/streams") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const stream = managedStreamSchema.parse(await readBody(request));
      const ingestBase = (process.env.STREAM_INGEST_URL || "").replace(/\/$/, "");
      let revealedKey: string | undefined;
      const data = await updateStore((store) => {
        const index = store.streams.findIndex((item) => item.id === stream.id);
        const previousSecret = index >= 0 ? store.streams[index].obs?.streamKey : undefined;

        // Prepare OBS config: generate stream key and set server/playback URLs for new streams
        const obsConfig = stream.obs ? { ...stream.obs } : undefined;
        if (obsConfig) {
          // If creating new stream and no streamKey provided, generate one
          if (index < 0 && !obsConfig.streamKey) {
            const generated = randomBytes(12).toString("base64url");
            revealedKey = generated;
            obsConfig.streamKey = generated;
            if (!obsConfig.serverUrl && ingestBase) obsConfig.serverUrl = ingestBase;
          }
        }

        // Protect stream key for storage (or keep previous if none provided)
        const storedObs = obsConfig ? { ...obsConfig, streamKey: obsConfig.streamKey ? protectSecret(obsConfig.streamKey) : previousSecret } : undefined;

        const storedStream = { ...stream, obs: storedObs } as StreamSource;

        if (index >= 0) store.streams[index] = storedStream;
        else store.streams.push(storedStream);
      });
      const responseStreams = managedStreams(data.streams).map((item) =>
        revealedKey && item.id === stream.id && item.obs
          ? { ...item, obs: { ...item.obs, streamKey: revealedKey } }
          : item,
      );
      return json(response, 200, responseStreams);
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/video-sources") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const source = videoSourceSchema.parse(await readBody(request)) as StoredVideoSource;
      const ingestBase = (process.env.STREAM_INGEST_URL || "").replace(/\/$/, "");
      let revealedKey: string | undefined;
      const data = await updateStore((store) => {
        const index = store.videoSources.findIndex((item) => item.id === source.id);
        const previousSecret = index >= 0 ? store.videoSources[index].obs?.streamKey : undefined;

        // Prepare OBS config: generate stream key and set server/playback URLs for new streams
        const obsConfig = source.obs ? { ...source.obs } : undefined;
        if (obsConfig) {
          // If creating new stream and no streamKey provided, generate one
          if (index < 0 && !obsConfig.streamKey) {
            const generated = randomBytes(12).toString("base64url");
            revealedKey = generated;
            obsConfig.streamKey = generated;
            if (!obsConfig.serverUrl && ingestBase) obsConfig.serverUrl = ingestBase;
          }
        }

        // Protect stream key for storage (or keep previous if none provided)
        const storedObs = obsConfig ? { ...obsConfig, streamKey: obsConfig.streamKey ? protectSecret(obsConfig.streamKey) : previousSecret } : undefined;

        const storedSource = { ...source, obs: storedObs } as StoredVideoSource;

        if (index >= 0) store.videoSources[index] = storedSource;
        else store.videoSources.push(storedSource);
      });
      const responseSources = managedVideoSources(data.videoSources).map((item) =>
        revealedKey && item.id === source.id && item.obs
          ? { ...item, obs: { ...item.obs, streamKey: revealedKey } }
          : item,
      );
      return json(response, 200, responseSources);
    }
    const sourceMatch = url.pathname.match(/^\/api\/admin\/video-sources\/([^/]+)$/);
    if (request.method === "DELETE" && sourceMatch) {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const data = await updateStore((store) => { store.videoSources = store.videoSources.filter((item) => item.id !== sourceMatch[1]); });
      return json(response, 200, managedVideoSources(data.videoSources));
    }

    const streamMatch = url.pathname.match(/^\/api\/admin\/streams\/([^/]+)$/);
    if (request.method === "DELETE" && streamMatch) {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const data = await updateStore((store) => { store.streams = store.streams.filter((item) => item.id !== streamMatch[1]); });
      return json(response, 200, managedStreams(data.streams));
    }

    if (request.method === "GET" && url.pathname === "/api/sponsors") return json(response, 200, await listPublicSponsorsPayload());
    if (request.method === "GET" && url.pathname === "/api/admin/sponsors") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await listManagedSponsorsPayload());
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/sponsors") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const body = await readBody(request);
      const sponsor = sponsorAdminSchema.parse(body);
      return json(response, 200, await saveManagedSponsorPayload(sponsor));
    }
    const sponsorMatch = url.pathname.match(/^\/api\/admin\/sponsors\/([^/]+)$/);
    if (request.method === "DELETE" && sponsorMatch) {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await deleteManagedSponsorPayload(sponsorMatch[1]));
    }

    if (request.method === "GET" && url.pathname === "/api/news") {
      return json(response, 200, await listNewsPayload(false));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/news") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await listNewsPayload(true));
    }
    const newsMatch = url.pathname.match(/^\/api\/admin\/news\/([^/]+)$/);
    if (newsMatch && request.method === "PUT") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const article = newsSchema.parse(await readBody(request));
      if (article.id !== newsMatch[1]) return json(response, 400, { error: "El ID de la noticia no coincide con la ruta" });
      return json(response, 200, await saveNewsPayload(article));
    }
    if (newsMatch && request.method === "DELETE") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const id = z.string().uuid().parse(newsMatch[1]);
      return json(response, 200, await deleteNewsPayload(id));
    }

    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await adminUsersPayload());
    }

    if (request.method === "GET" && url.pathname === "/api/admin/chat/reports") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await adminChatReportsPayload());
    }

    if (request.method === "GET" && url.pathname === "/api/admin/audit") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await adminAuditPayload());
    }

    if (request.method === "POST" && url.pathname === "/api/internal/analytics/sync") {
      if (!process.env.CRON_SECRET?.trim()) return json(response, 503, { error: "Sincronización no configurada" });
      if (!bearerSecretMatches(request, process.env.CRON_SECRET.trim())) return json(response, 401, { error: "No autorizado" });
      const today = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
      try {
        const result = await maybeSyncWebAnalytics(start, today, true);
        return json(response, 200, { ok: true, ...result, start, end: today });
      } catch (error) {
        const code = error instanceof Error && error.message.startsWith("CLOUDFLARE_ANALYTICS_")
          ? error.message
          : "ANALYTICS_SYNC_FAILED";
        console.warn("[web-analytics] scheduled sync failed", { code });
        return json(response, 503, { error: "No se pudo sincronizar la analítica", code });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/web-analytics") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const parsedPeriod = webAnalyticsPeriodSchema.safeParse(url.searchParams.get("period") ?? "week");
      if (!parsedPeriod.success) return json(response, 400, { error: "Período no válido" });
      const period = parsedPeriod.data as WebAnalyticsPeriod;
      const range = periodRange(period);
      const config = getCloudflareWebAnalyticsConfig();
      let syncStatus: "ready" | "not_configured" | "error" = config ? "ready" : "not_configured";
      let syncErrorCode: string | undefined;
      if (config) {
        try {
          await maybeSyncWebAnalytics(cloudflareBackfillStart(range.start), range.end);
        } catch (error) {
          syncStatus = "error";
          syncErrorCode = error instanceof Error && error.message.startsWith("CLOUDFLARE_ANALYTICS_")
            ? error.message
            : "ANALYTICS_SYNC_FAILED";
          console.warn("[web-analytics] admin refresh failed; using persisted data", { code: syncErrorCode });
        }
      }
      try {
        const [currentRows, previousRows] = await Promise.all([
          webAnalyticsRows(range.start, range.end, config?.siteTag),
          webAnalyticsRows(range.previousStart, range.previousEnd, config?.siteTag),
        ]);
        return json(response, 200, {
          ...summarizeWebAnalytics(period, range, currentRows, previousRows),
          source: "cloudflare",
          configured: Boolean(config),
          syncStatus,
          syncErrorCode,
        });
      } catch (error) {
        console.warn("[web-analytics] persisted metrics unavailable", { code: "ANALYTICS_STORAGE_UNAVAILABLE" });
        return json(response, 503, { error: "La analítica web todavía no está disponible", code: "ANALYTICS_STORAGE_UNAVAILABLE" });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/metrics/overview") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      try {
        const startParam = url.searchParams.get("start");
        const endParam = url.searchParams.get("end");
        const start = startParam ? new Date(startParam).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
        const end = endParam ? new Date(endParam).toISOString() : new Date().toISOString();
        const supa = getAdminSupabaseClient();
        const { data, error } = await supa.rpc("metrics_overview", { p_start: start, p_end: end });
        if (!error && data) return json(response, 200, data);
        // Fallback: compute aggregates from tables if RPC not available
        const { count: totalEvents, error: ev } = await supa.from("activity_events").select("id", { head: true, count: "exact" }).gte("occurred_at", start).lt("occurred_at", end);
        const { count: totalImpressions, error: ei } = await supa.from("sponsor_impressions").select("id", { head: true, count: "exact" }).gte("occurred_at", start).lt("occurred_at", end);
        const { count: totalClicks, error: ec } = await supa.from("sponsor_clicks").select("id", { head: true, count: "exact" }).gte("occurred_at", start).lt("occurred_at", end);
        // unique ids: fetch a reasonable sample and compute distinct
        const { data: evrows } = await supa.from("activity_events").select("user_id,anonymous_id").gte("occurred_at", start).lt("occurred_at", end).limit(10000);
        const ids = new Set();
        for (const r of evrows ?? []) ids.add(String(r.user_id ?? r.anonymous_id ?? "__null"));
        return json(response, 200, {
          total_activity_events: totalEvents ?? 0,
          total_sponsor_impressions: totalImpressions ?? 0,
          total_sponsor_clicks: totalClicks ?? 0,
          unique_active_ids: ids.size,
        });
      } catch (err) {
        console.error(err);
        return json(response, 500, { error: "Error al obtener métricas" });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/metrics/streams") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      try {
        const startParam = url.searchParams.get("start");
        const endParam = url.searchParams.get("end");
        const start = startParam ? new Date(startParam).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
        const end = endParam ? new Date(endParam).toISOString() : new Date().toISOString();
        const supa = getAdminSupabaseClient();
        const { data: events, error } = await supa.from("activity_events").select("stream_id,event_type,properties,user_id,anonymous_id,occurred_at").gte("occurred_at", start).lt("occurred_at", end).limit(10000);
        if (error) return json(response, 500, { error: error.message });
        const map = new Map<string, StreamMetricAggregation>();
        for (const e of events ?? []) {
          const sid = e.stream_id ?? "__unknown";
          let entry = map.get(sid);
          if (!entry) entry = { streamId: sid, viewStarts: 0, uniqueUsers: new Set<string>(), peakViewers: 0, sumViewers: 0, viewerSamples: 0 };
          if (e.event_type === "view_start") entry.viewStarts++;
          const uid = e.user_id ?? e.anonymous_id;
          if (uid) entry.uniqueUsers.add(String(uid));
          const props = e.properties ?? {};
          const cv = props && (props.concurrent_viewers ?? props.concurent_viewers ?? props['concurrent_viewers']);
          const cvNum = cv ? Number(cv) : NaN;
          if (!Number.isNaN(cvNum)) {
            entry.peakViewers = Math.max(entry.peakViewers, cvNum);
            entry.sumViewers += cvNum;
            entry.viewerSamples++;
          }
          map.set(sid, entry);
        }
        const result = Array.from(map.values()).map((r) => ({
          streamId: r.streamId,
          view_starts: r.viewStarts,
          unique_users: r.uniqueUsers.size,
          peak_viewers: r.peakViewers,
          avg_viewers: r.viewerSamples ? r.sumViewers / r.viewerSamples : 0,
        }));
        return json(response, 200, result);
      } catch (err) {
        console.error(err);
        return json(response, 500, { error: "Error al obtener métricas por stream" });
      }
    }

    if (await handleCollection(request, response, url.pathname, "highlights", highlightSchema) !== false) return;

    if (request.method === "GET" && url.pathname === "/api/chat/messages") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Realtime" });
      return json(response, 200, (await readStore()).chatMessages.slice(-200));
    }
    if (request.method === "POST" && url.pathname === "/api/chat/messages") {
      if (!LEGACY_AUTH_ENABLED) return json(response, 410, { error: "Usa Supabase Realtime" });
      const input = chatSchema.parse(await readBody(request));
      const lastMessageAt = chatRateLimit.get(input.clientId) ?? 0;
      if (Date.now() - lastMessageAt < 4000) return json(response, 429, { error: "Modo lento activo" });
      chatRateLimit.set(input.clientId, Date.now());
      const message = { id: crypto.randomUUID(), user: { id: input.clientId, name: input.displayName, avatarColor: "142 70% 48%" }, text: input.text, createdAt: new Date().toISOString(), channel: input.channel } as const;
      await updateStore((store) => { store.chatMessages = [...store.chatMessages.slice(-199), message]; });
      return json(response, 201, message);
    }
    if (request.method === "POST" && url.pathname === "/api/contact") {
      const input = contactSchema.parse(await readBody(request));
      const entry = { id: crypto.randomUUID(), name: input.name, email: input.email, subject: input.subject ?? null, message: input.message, createdAt: new Date().toISOString() };
      await updateStore((store) => {
        store.contactMessages.push({ ...entry, subject: entry.subject ?? undefined });
      });
      console.log("Received contact message");
      return json(response, 201, { ok: true });
    }
    // ── Cloudflare Stream Webhook ──────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/api/webhooks/cloudflare/stream-live") {
      const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
      const cfAuth = request.headers["cf-webhook-auth"];

      if (!validateWebhookSecret(webhookSecret, cfAuth)) {
        return json(response, 401, { error: "Secreto de webhook inválido" });
      }

      const parsed = cloudflareLiveWebhookSchema.safeParse(await readBody(request));
      if (!parsed.success) return json(response, 400, { error: "Payload de webhook inválido" });

      const { input_id: inputUid, event_type: eventType, updated_at: updatedAt, error_code: errorCode } = parsed.data.data;
      const newStatus = mapCloudflareEventToStatus(eventType);
      if (!newStatus) return json(response, 200, { ok: true }); // unknown event — ignore gracefully

      if (!canUseAdminSupabase()) {
        // No DB — just acknowledge
        return json(response, 200, { ok: true });
      }

      const { error } = await getAdminSupabaseClient().rpc("process_live_source_webhook", {
        p_event_key: buildWebhookEventKey(inputUid, eventType, updatedAt),
        p_provider_input_id: inputUid,
        p_event_type: eventType,
        p_status: newStatus,
        p_updated_at: updatedAt,
        p_error_code: newStatus === "provider_error" ? errorCode || "CLOUDFLARE_STREAM_ERRORED" : null,
      });
      if (error) return json(response, 500, { error: "No se pudo procesar el evento" });

      return json(response, 200, { ok: true });
    }

    return json(response, 404, { error: "Ruta no encontrada" });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return json(response, error.status, { error: error.status === 413 ? "Cuerpo de solicitud demasiado grande" : "JSON inválido" });
    }
    if (error instanceof z.ZodError) {
      return json(response, 400, { error: "Datos inválidos", issues: error.issues });
    }
    if (error instanceof Error && error.message.startsWith("La tabla sponsors")) return json(response, 500, { error: error.message });
    console.error("Unhandled request error");
    return json(response, 500, { error: "Error interno" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Luis Romero Futbol API listening on http://${HOST}:${PORT}`);
});
