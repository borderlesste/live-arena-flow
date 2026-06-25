import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createCipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { readStore, updateStore, type StoreData, type StoredUser, type StoredVideoSource } from "./store.js";
import { createSportsProvider, sportsProviderDiagnostics } from "./modules/sports/index.js";
import { hasSupabaseRole } from "./modules/auth/authorization.js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { StreamSource } from "../src/types/index.js";
import { embedUrlSchema, mediaUrlSchema } from "../src/schemas/stream.schema.js";
import { sponsorAdminSchema, type ManagedSponsor } from "../src/schemas/sponsor.schema.js";
import { isMissingSponsorColumn, sponsorColumns, sponsorFromRow, sponsorToRow, type SponsorRow } from "../src/schemas/sponsor.persistence.ts";

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN?.trim();
const STREAM_SECRET_KEY = process.env.STREAM_SECRET_KEY || "";
const LEGACY_AUTH_ENABLED = process.env.NODE_ENV !== "production" && process.env.LEGACY_AUTH_ENABLED !== "false";
const chatRateLimit = new Map<string, number>();
const scryptAsync = promisify(scrypt);
const sportsProvider = createSportsProvider();
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
if (process.env.NODE_ENV === "production" && (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || !(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY))) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required in production");
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
    protocol: z.enum(["rtmp", "srt"]),
    serverUrl: z.string().min(1),
    streamKey: z.string().optional(),
  }).optional(),
});
function validateStreamPayload(source: z.infer<typeof streamPayloadBaseSchema>, ctx: z.RefinementCtx) {
  if (["hls", "obs_hls", "mp4", "mp3"].includes(source.type)) {
    const parsed = mediaUrlSchema.safeParse(source.url);
    if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL de media inválida", path: ["url"] });
    return;
  }
  const parsed = embedUrlSchema.safeParse(source.embedUrl);
  if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL de embed inválida", path: ["embedUrl"] });
}
const videoSourceSchema = streamPayloadBaseSchema.extend({
  matchId: z.string().min(1),
  createdAt: z.string(),
}).superRefine(validateStreamPayload);
const managedStreamSchema = streamPayloadBaseSchema.superRefine(validateStreamPayload);
const newsSchema = z.object({ id: z.string(), title: z.string(), category: z.string(), excerpt: z.string(), publishedAt: z.string(), imageHue: z.number() });
const highlightSchema = z.object({ id: z.string(), title: z.string(), matchId: z.string().optional(), durationSec: z.number(), publishedAt: z.string(), imageHue: z.number(), kind: z.enum(["summary", "play", "clip", "interview", "replay"]) });
const chatSchema = z.object({ text: z.string().trim().min(1).max(280), channel: z.enum(["community", "official"]), clientId: z.string().min(1).max(80), displayName: z.string().min(1).max(40) });
const contactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(1).max(2000),
});
const credentialsSchema = z.object({ email: z.string().trim().email().max(160), password: z.string().min(8).max(128) });
const registerSchema = credentialsSchema.extend({ displayName: z.string().trim().min(2).max(40) });
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  preferences: z.object({ matchReminders: z.boolean() }),
});
const favoriteMatchIdSchema = z.string().trim().min(1).max(160);
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
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
}

function supabaseAuthConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
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
    secondarySportsProvider: sports.secondaryProvider ?? "optional_not_configured",
    sportsProviders: {
      sportsdataio: sports.sportsDataIoConfigured ? "configured" : "not_configured",
      thesportsdb: sports.theSportsDbConfigured ? "configured" : process.env.NODE_ENV === "production" ? "not_configured" : "dev_public_key",
    },
  };
}

async function isAdmin(request: IncomingMessage): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && ADMIN_TOKEN && request.headers.authorization === `Bearer ${ADMIN_TOKEN}`) return true;
  return hasSupabaseRole(request, ["super_admin", "admin"]);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function publicVideoSources(sources: StoredVideoSource[]) {
  return sources.map(({ obs: _obs, ...source }) => source);
}

function managedVideoSources(sources: StoredVideoSource[]) {
  return sources.map((source) => ({
    ...source,
    obs: source.obs ? { ...source.obs, streamKey: undefined, hasStreamKey: Boolean(source.obs.streamKey) } : undefined,
  }));
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

function publicSponsors(sponsors: Awaited<ReturnType<typeof readStore>>["sponsors"]) {
  const now = Date.now();
  return sponsors
    .map(normalizeManagedSponsor)
    .filter((sponsor) => sponsor.status === "active"
      && (!sponsor.startsAt || new Date(sponsor.startsAt).getTime() <= now)
      && (!sponsor.endsAt || new Date(sponsor.endsAt).getTime() > now))
    .sort((left, right) => right.priority - left.priority)
    .map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      tagline: sponsor.description,
      url: sponsor.destinationUrl,
      logoUrl: sponsor.logoUrl,
      darkLogoUrl: sponsor.darkLogoUrl,
      altText: sponsor.altText,
      monogram: sponsorMonogram(sponsor.name),
      color: sponsorColor(sponsor.id),
      tier: sponsor.type,
    }));
}

async function listManagedSponsorsPayload(): Promise<ManagedSponsor[]> {
  if (!canUseAdminSupabase()) return (await readStore()).sponsors.map(normalizeManagedSponsor);
  const { data, error } = await getAdminSupabaseClient()
    .from("sponsors")
    .select(sponsorColumns)
    .is("deleted_at", null)
    .order("priority", { ascending: false });
  if (isMissingSponsorColumn(error)) throw new Error("La tabla sponsors no tiene todos los campos administrativos. Ejecuta las migraciones de Supabase.");
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
  const { error } = await getAdminSupabaseClient()
    .from("sponsors")
    .upsert(sponsorToRow(sponsor), { onConflict: "id" });
  if (isMissingSponsorColumn(error)) throw new Error("La tabla sponsors no tiene todos los campos administrativos. Ejecuta las migraciones de Supabase.");
  if (error) throw error;
  return listManagedSponsorsPayload();
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

function getAnonSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
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
  setCors(request, response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, healthPayload());
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
      if ((await readStore()).users.some((user) => user.email === email)) return json(response, 409, { error: "Ya existe una cuenta con ese correo" });
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
      await updateStore((store) => { store.users.push(user); });
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
      const data = await updateStore((store) => {
        const current = store.users.find((item) => item.id === user.id);
        if (current) { current.displayName = input.displayName; current.preferences = input.preferences; }
      });
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

    if (request.method === "GET" && url.pathname === "/api/video-sources") return json(response, 200, publicVideoSources((await readStore()).videoSources));
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
      const data = await updateStore((store) => {
        const index = store.streams.findIndex((item) => item.id === stream.id);
        const previousSecret = index >= 0 ? store.streams[index].obs?.streamKey : undefined;
        const protectedStream = {
          ...stream,
          obs: stream.obs ? { ...stream.obs, streamKey: stream.obs.streamKey ? protectSecret(stream.obs.streamKey) : previousSecret } : undefined,
        };
        if (index >= 0) store.streams[index] = protectedStream;
        else store.streams.push(protectedStream);
      });
      return json(response, 200, managedStreams(data.streams));
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/video-sources") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const source = videoSourceSchema.parse(await readBody(request)) as StoredVideoSource;
      const data = await updateStore((store) => {
        const index = store.videoSources.findIndex((item) => item.id === source.id);
        const previousSecret = index >= 0 ? store.videoSources[index].obs?.streamKey : undefined;
        const protectedSource = {
          ...source,
          obs: source.obs ? {
            ...source.obs,
            streamKey: source.obs.streamKey ? protectSecret(source.obs.streamKey) : previousSecret,
          } : undefined,
        };
        if (index >= 0) store.videoSources[index] = protectedSource;
        else store.videoSources.push(protectedSource);
      });
      return json(response, 200, managedVideoSources(data.videoSources));
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

    if (request.method === "GET" && url.pathname === "/api/sponsors") return json(response, 200, publicSponsors((await readStore()).sponsors));
    if (request.method === "GET" && url.pathname === "/api/admin/sponsors") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await listManagedSponsorsPayload());
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/sponsors") {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      const sponsor = sponsorAdminSchema.parse(await readBody(request));
      return json(response, 200, await saveManagedSponsorPayload(sponsor));
    }
    const sponsorMatch = url.pathname.match(/^\/api\/admin\/sponsors\/([^/]+)$/);
    if (request.method === "DELETE" && sponsorMatch) {
      if (!await isAdmin(request)) return json(response, 403, { error: "No autorizado" });
      return json(response, 200, await deleteManagedSponsorPayload(sponsorMatch[1]));
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

    if (await handleCollection(request, response, url.pathname, "news", newsSchema) !== false) return;
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
    return json(response, 404, { error: "Ruta no encontrada" });
  } catch (error) {
    if (error instanceof z.ZodError) return json(response, 400, { error: "Datos inválidos", issues: error.issues });
    if (error instanceof Error && error.message.startsWith("La tabla sponsors")) return json(response, 500, { error: error.message });
    console.error(error);
    return json(response, 500, { error: "Error interno" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Luis Romero Futbol API listening on http://${HOST}:${PORT}`);
});
