import { z } from "zod";
import { ResilientHttpClient, type NormalizedSportsEvent, type SportsProvider } from "./sports-provider.js";

const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().nullish(),
);

const rawEventSchema = z.object({
  idEvent: z.string(), strTimestamp: z.string().nullish(), dateEvent: z.string().nullish(), strTime: z.string().nullish(),
  strSport: z.string().nullish(), idLeague: z.string().nullish(), strLeague: z.string().nullish(), strLeagueBadge: optionalUrl,
  idHomeTeam: z.string().nullish(), strHomeTeam: z.string().nullish(), strHomeTeamBadge: optionalUrl,
  idAwayTeam: z.string().nullish(), strAwayTeam: z.string().nullish(), strAwayTeamBadge: optionalUrl,
  intHomeScore: z.union([z.string(), z.number()]).nullish(), intAwayScore: z.union([z.string(), z.number()]).nullish(),
  strStatus: z.string().nullish(), strPostponed: z.string().nullish(), strVenue: z.string().nullish(), strCity: z.string().nullish(),
  strCountry: z.string().nullish(), strVideo: optionalUrl,
}).passthrough();
const responseSchema = z.object({ events: z.array(rawEventSchema).nullish() });
const liveScoreSchema = rawEventSchema.extend({
  idLiveScore: z.union([z.string(), z.number()]).nullish(),
  strProgress: z.string().nullish(),
  strEventTime: z.string().nullish(),
  updated: z.string().nullish(),
});
const liveScoreResponseSchema = z.object({ livescore: z.array(liveScoreSchema).nullish(), events: z.array(liveScoreSchema).nullish() }).passthrough();
type RawEvent = z.infer<typeof rawEventSchema>;
type RawLiveScore = z.infer<typeof liveScoreSchema>;
const SUPPORTED_SPORTS = ["Soccer"] as const;
const LIVE_STATUS_CODES = [
  "1H", "2H", "ET", "LIVE", "IN PLAY", "IN PROGRESS", "Q1", "Q2", "Q3", "Q4", "OT", "BT", "P", "PT",
  "IN1", "IN2", "IN3", "IN4", "IN5", "IN6", "IN7", "IN8", "IN9", "P1", "P2", "P3", "S1", "S2", "S3", "S4", "S5",
];

function status(event: RawEvent): NormalizedSportsEvent["status"] {
  if (event.strPostponed?.toLowerCase() === "yes") return "postponed";
  const value = event.strStatus?.toUpperCase();
  if (["FT", "AET", "PEN", "MATCH FINISHED", "FINISHED", "FULL TIME"].includes(value ?? "")) return "finished";
  if (["PST", "POSTP"].includes(value ?? "")) return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(value ?? "")) return "cancelled";
  if (value === "HT") return "halftime";
  if (["SUSP", "INT", "INTR", "PAUSED"].includes(value ?? "")) return "paused";
  if (LIVE_STATUS_CODES.includes(value ?? "")) return "live";
  return "scheduled";
}

function liveScoreStatus(event: RawLiveScore): NormalizedSportsEvent["status"] {
  const progress = event.strProgress?.trim().toUpperCase();
  if (progress && ["FINAL", "FT", "FINISHED", "MATCH FINISHED", "FULL TIME"].includes(progress)) return "finished";
  if (progress && ["HALFTIME", "HALF TIME", "HT"].includes(progress)) return "halftime";
  if (progress && ["SUSPENDED", "INTERRUPTED", "PAUSED"].includes(progress)) return "paused";
  const mapped = status(event);
  return mapped === "scheduled" ? "live" : mapped;
}

function startsAt(event: RawEvent): string {
  const timestamp = event.strTimestamp || `${event.dateEvent ?? "1970-01-01"}T${event.strTime ?? "00:00:00"}Z`;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`;
  const value = new Date(normalized);
  return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
}

function score(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function normalize(event: RawEvent): NormalizedSportsEvent {
  return {
    id: event.idEvent,
    startsAt: startsAt(event),
    sport: event.strSport ?? "Other",
    competition: { id: event.idLeague ?? `league-${event.idEvent}`, name: event.strLeague ?? "Competition", region: event.strCountry ?? undefined, badgeUrl: event.strLeagueBadge ?? undefined },
    homeTeam: { id: event.idHomeTeam ?? `home-${event.idEvent}`, name: event.strHomeTeam ?? "Home TBD", badgeUrl: event.strHomeTeamBadge ?? undefined },
    awayTeam: { id: event.idAwayTeam ?? `away-${event.idEvent}`, name: event.strAwayTeam ?? "Away TBD", badgeUrl: event.strAwayTeamBadge ?? undefined },
    homeScore: score(event.intHomeScore), awayScore: score(event.intAwayScore), status: status(event), statusLabel: event.strStatus ?? undefined,
    venue: event.strVenue ?? undefined, city: event.strCity ?? undefined, highlightUrl: event.strVideo ?? undefined,
  };
}

function normalizeLiveScore(event: RawLiveScore): NormalizedSportsEvent {
  const base = normalize({
    ...event,
    strTimestamp: event.strTimestamp ?? event.updated ?? undefined,
    strTime: event.strTime ?? event.strEventTime ?? undefined,
  });
  return {
    ...base,
    status: liveScoreStatus(event),
    statusLabel: event.strProgress ?? event.strStatus ?? undefined,
  };
}

function dateOffset(offset: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export class TheSportsDbProvider implements SportsProvider {
  readonly name = "thesportsdb";
  private readonly baseUrl: string;

  constructor(apiKey: string, private readonly client = new ResilientHttpClient()) {
    this.baseUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/`;
  }

  private async request(endpoint: string, params: Record<string, string>) {
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return (responseSchema.parse(await this.client.json(url)).events ?? []).map(normalize);
  }

  async eventsByDate(date: string) {
    const groups = await Promise.all(SUPPORTED_SPORTS.map((sport) => this.request("eventsday.php", { d: date, s: sport })));
    return [...new Map(groups.flat().map((event) => [event.id, event])).values()];
  }

  async liveEvents() {
    const fromLiveScore = await this.requestLiveScores();
    if (fromLiveScore.length > 0) return fromLiveScore;
    const window = await Promise.all([-1, 0, 1].map((offset) => this.eventsByDate(dateOffset(offset))));
    return window.flat().filter((event) => ["live", "halftime", "paused"].includes(event.status));
  }

  private async requestLiveScores() {
    const apiKey = this.baseUrl.match(/\/json\/([^/]+)\//)?.[1];
    if (!apiKey || apiKey === "123") return [];
    const groups = await Promise.allSettled(SUPPORTED_SPORTS.map(async (sport) => {
      const url = new URL("livescore.php", "https://www.thesportsdb.com/api/v2/json/");
      url.searchParams.set("s", sport);
      const payload = liveScoreResponseSchema.parse(await this.client.json(url, { headers: { "X-API-KEY": apiKey } }));
      return (payload.livescore ?? payload.events ?? []).map(normalizeLiveScore);
    }));
    const events = groups.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return [...new Map(events.map((event) => [event.id, event])).values()];
  }

  async eventById(id: string) {
    if (id.startsWith("sportsdata-")) return undefined;
    return (await this.request("lookupevent.php", { id }))[0];
  }
}
