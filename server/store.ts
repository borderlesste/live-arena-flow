import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ChatMessage, Highlight, NewsArticle, Sponsor, StreamSource, StreamType } from "../src/types/index.js";
import type { ManagedSponsor } from "../src/schemas/sponsor.schema.js";
import type { LiveSourceStatus } from "../src/schemas/live-source.schema.js";

export type StoredSponsor = Sponsor & Partial<ManagedSponsor>;

export interface StoredVideoSource {
  id: string;
  matchId: string;
  /** Internal Supabase match UUID; public/provider matchId remains stable. */
  catalogMatchId?: string;
  createdAt: string;
  type: StreamType;
  url?: string;
  embedUrl?: string;
  title: string;
  isExternal?: boolean;
  requiresConsent?: boolean;
  /** Streaming provider — "custom" for RTMP, or any string identifier for external providers. */
  provider?: "youtube" | "tiktok" | "vimeo" | "custom" | (string & {});
  purpose?: "live" | "highlight";
  obs?: { protocol: "rtmp" | "rtmps" | "srt"; serverUrl: string; streamKey?: string };
  // New fields for modular live sources architecture:
  sourceKind?: "manual" | "obs";
  usageType?: "live" | "highlight" | "prerecorded";
  playbackFormat?: string;
  playbackUrl?: string;
  playbackUrlVerified?: boolean;
  coverImageUrl?: string;
  providerInputId?: string;
  ingestProtocol?: "rtmp" | "rtmps" | "srt";
  ingestUrl?: string;
  streamKeyCiphertext?: string;
  streamKeyIv?: string;
  streamKeyLast4?: string;
  credentialsVersion?: number;
  status?: LiveSourceStatus;
  statusMessage?: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
  recordingEnabled?: boolean;
  lowLatencyEnabled?: boolean;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastProviderSyncAt?: string;
  providerErrorCode?: string;
  updatedAt?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
}

export interface UserPreferences {
  matchReminders: boolean;
}

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  preferences: UserPreferences;
}

export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface StoredContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt: string;
}

export interface StoredFavoriteMatch {
  userId: string;
  externalMatchId: string;
  createdAt: string;
}

export interface StoredBrandSettings {
  platformName: string;
  logoPrimary: string;
  logoDarkBackground: string;
  logoLightBackground: string;
  symbol: string;
  symbolWhite: string;
  favicon: string;
  primaryColor: string;
  hoverColor: string;
  darkColor: string;
  deepBackground: string;
}

export const DEFAULT_BRAND_SETTINGS: StoredBrandSettings = {
  platformName: "Luis Romero Fútbol",
  logoPrimary: "/brand/logos/logo-primary.png",
  logoDarkBackground: "/brand/logos/logo-white.png",
  logoLightBackground: "/brand/logos/logo-dark.png",
  symbol: "/brand/symbols/symbol-green-dark.png",
  symbolWhite: "/brand/symbols/symbol-white.png",
  favicon: "/brand/symbols/symbol-green-dark.png",
  primaryColor: "#77A608",
  hoverColor: "#628C04",
  darkColor: "#355700",
  deepBackground: "#012501",
};

export interface StoreData {
  brandSettings: StoredBrandSettings;
  sponsors: StoredSponsor[];
  news: NewsArticle[];
  highlights: Highlight[];
  videoSources: StoredVideoSource[];
  streams: StreamSource[];
  chatMessages: ChatMessage[];
  contactMessages: StoredContactMessage[];
  favoriteMatches: StoredFavoriteMatch[];
  users: StoredUser[];
  sessions: StoredSession[];
}

const EMPTY_STORE: StoreData = {
  brandSettings: DEFAULT_BRAND_SETTINGS,
  sponsors: [],
  news: [],
  highlights: [],
  videoSources: [],
  streams: [],
  chatMessages: [],
  contactMessages: [],
  favoriteMatches: [],
  users: [],
  sessions: [],
};
const STORE_PATH = resolve(process.env.DATA_FILE || "server/data/app.json");
let writeQueue = Promise.resolve();

export async function readStore(): Promise<StoreData> {
  try {
    const stored = JSON.parse(await readFile(STORE_PATH, "utf8")) as Partial<StoreData>;
    return { ...EMPTY_STORE, ...stored, brandSettings: { ...DEFAULT_BRAND_SETTINGS, ...stored.brandSettings } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return structuredClone(EMPTY_STORE);
  }
}

export function updateStore(update: (data: StoreData) => void): Promise<StoreData> {
  let result: StoreData;
  writeQueue = writeQueue.then(async () => {
    result = await readStore();
    update(result);
    await mkdir(dirname(STORE_PATH), { recursive: true });
    const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(result, null, 2), "utf8");
    await rename(temporaryPath, STORE_PATH);
  });
  return writeQueue.then(() => result!);
}
