// Core domain types for Luis Romero Fútbol

export type Sport = "football";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "paused"
  | "finished"
  | "postponed"
  | "cancelled";

export type StreamType =
  | "youtube"
  | "youtube_live"
  | "embed"
  | "iframe"
  | "mp4"
  | "mp3"
  | "hls"
  | "obs_hls";

export type StreamStatus =
  | "idle"
  | "loading"
  | "live"
  | "buffering"
  | "offline"
  | "error"
  | "blocked";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  city?: string;
  /** Two-letter monogram used to render the badge (no copyrighted crests). */
  monogram: string;
  /** HSL color tuple `h s% l%` — used as a CSS var. */
  color: string;
  badgeUrl?: string;
}

export interface Competition {
  id: string;
  name: string;
  region: string;
  sport: Sport;
  /** Monogram for the competition badge. */
  monogram: string;
  color: string;
  activeMatches: number;
  nextEventAt?: string; // ISO
  badgeUrl?: string;
}

export interface StandingRow {
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
}

export interface StreamSource {
  id: string;
  type: StreamType;
  /** Direct media URL (HLS/HTML5/WebRTC). */
  url?: string;
  /** Iframe embed URL (YouTube/TikTok/other). */
  embedUrl?: string;
  title: string;
  isExternal: boolean;
  /** True for third-party providers that drop cookies. */
  requiresConsent?: boolean;
  /** Known embed providers; use "custom" or any string for other providers. */
  provider?: "youtube" | "tiktok" | "vimeo" | "custom" | (string & {});
  purpose?: "live" | "highlight";
  obs?: OBSIngestConfig;
}

export interface OBSIngestConfig {
  protocol: "rtmp" | "rtmps" | "srt";
  serverUrl: string;
  streamKey?: string;
}

export interface Match {
  id: string;
  sport: Sport;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  /** Minute / period / inning, plain text. */
  clock?: string;
  startsAt: string; // ISO
  venue: string;
  viewers?: number;
  streams: StreamSource[];
  highlights?: StreamSource[];
  hasReplay?: boolean;
  hasSummary?: boolean;
}

export interface ChatUser {
  id: string;
  name: string;
  avatarColor: string;
  badges?: ("mod" | "vip" | "official" | "verified")[];
}

export interface ChatMessage {
  id: string;
  user: ChatUser;
  /** Always treated as plain text. */
  text: string;
  createdAt: string; // ISO
  pinned?: boolean;
  channel: "community" | "official";
  /** Reaction counts supplied by the platform API. */
  reactions?: Record<string, number>;
}

export interface Sponsor {
  id: string;
  name: string;
  tagline?: string;
  url?: string;
  logoUrl?: string;
  darkLogoUrl?: string;
  altText?: string;
  monogram: string;
  color: string;
  tier: "main" | "official" | "partner";
}

export interface NewsArticle {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  /** Full article body (markdown or plain text). Optional for backward compat. */
  body?: string;
  /** Image persisted in the news table as a validated data URL. */
  image?: string;
  /** Cover image URL. When absent, a gradient using imageHue is shown instead. */
  coverImageUrl?: string;
  /** Paid editorial content must be clearly disclosed to readers. */
  isSponsored?: boolean;
  /** Public sponsor name shown with the disclosure. */
  sponsorName?: string;
  publishedAt: string;
  imageHue: number; // 0-360, used for generated cover gradient when no coverImageUrl
}

export interface Highlight {
  id: string;
  title: string;
  matchId?: string;
  durationSec: number;
  publishedAt: string;
  imageHue: number;
  kind: "summary" | "play" | "clip" | "interview" | "replay";
}
