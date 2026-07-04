import { z } from "zod";
import {
  normalizedSportsEventSchema,
  ResilientHttpClient,
  type NormalizedSportsEvent,
  type SportsProvider,
} from "./sports-provider.js";

export const SPORTSRC_API_BASE_URL = "https://api.sportsrc.org/v2/";

const identifierSchema = z.union([z.string(), z.number()]).transform(String);
const optionalStringSchema = z.string().nullish().transform((value) => value?.trim() || undefined);
const scoreValueSchema = z.union([z.string(), z.number()]).nullish().transform((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
});

const leagueSchema = z.object({
  name: z.string().min(1),
  country: optionalStringSchema,
  flag: optionalStringSchema,
  logo: optionalStringSchema,
}).passthrough();

const teamSchema = z.object({
  name: z.string().min(1),
  code: optionalStringSchema,
  badge: optionalStringSchema,
  color: optionalStringSchema,
}).passthrough();

const matchSchema = z.object({
  id: identifierSchema,
  timestamp: z.union([z.string(), z.number()]),
  title: optionalStringSchema,
  status: optionalStringSchema,
  status_detail: optionalStringSchema,
  round: z.union([z.string(), z.number()]).nullish(),
  has_highlights: z.boolean().optional(),
  teams: z.object({ home: teamSchema, away: teamSchema }),
  score: z.object({
    current: z.object({ home: scoreValueSchema, away: scoreValueSchema }).nullish(),
    display: optionalStringSchema,
    normal_time: z.unknown().optional(),
    period_1: z.unknown().optional(),
    period_2: z.unknown().optional(),
  }).nullish(),
  league: leagueSchema.optional(),
}).passthrough();

const matchGroupSchema = z.object({
  league: leagueSchema,
  matches: z.array(z.unknown()),
}).passthrough();

const listEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.array(matchGroupSchema),
}).passthrough();

const detailEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    match_info: matchSchema,
    info: z.object({ venue: z.unknown().optional() }).passthrough().optional(),
    sources: z.array(z.unknown()).optional(),
  }).passthrough(),
}).passthrough();

type SportSrcLeague = z.infer<typeof leagueSchema>;
type SportSrcMatch = z.infer<typeof matchSchema>;

function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function entityId(prefix: string, value: string): string {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `sportsrc-${prefix}-${slug || "unknown"}`;
}

function normalizeTimestamp(value: string | number): string {
  if (typeof value === "number" || /^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) throw new Error("SPORTSRC_INVALID_TIMESTAMP");
    const milliseconds = numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  throw new Error("SPORTSRC_INVALID_TIMESTAMP");
}

function normalizeStatus(status?: string, detail?: string): NormalizedSportsEvent["status"] {
  const normalized = status?.trim().toLowerCase().replace(/[\s_-]+/g, "") ?? "";
  const normalizedDetail = detail?.trim().toLowerCase().replace(/[\s_-]+/g, "") ?? "";
  if (normalized === "finished") return "finished";
  if (["inprogress", "live"].includes(normalized)) {
    return normalizedDetail === "halftime" ? "halftime" : "live";
  }
  if (["interrupted", "suspended", "paused"].includes(normalized)) return "paused";
  if (normalized === "postponed") return "postponed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  return "scheduled";
}

function venueName(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["name", "stadium", "venue"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return undefined;
}

function normalize(match: SportSrcMatch, groupedLeague?: SportSrcLeague, venue?: unknown): NormalizedSportsEvent {
  const league = match.league ?? groupedLeague;
  if (!league) throw new Error("SPORTSRC_MISSING_LEAGUE");
  // Short codes are not globally unique (for example MAR can represent a
  // national team or a club). Include the full name to prevent catalog rows
  // from overwriting unrelated teams.
  const homeKey = `${match.teams.home.name}-${match.teams.home.code ?? ""}`;
  const awayKey = `${match.teams.away.name}-${match.teams.away.code ?? ""}`;
  const leagueKey = `${league.country ?? "international"}-${league.name}`;

  return normalizedSportsEventSchema.parse({
    id: `sportsrc-${match.id}`,
    startsAt: normalizeTimestamp(match.timestamp),
    sport: "Football",
    competition: {
      id: entityId("competition", leagueKey),
      name: league.name,
      region: league.country,
      badgeUrl: safeUrl(league.logo),
    },
    homeTeam: {
      id: entityId("team", homeKey),
      name: match.teams.home.name,
      badgeUrl: safeUrl(match.teams.home.badge),
    },
    awayTeam: {
      id: entityId("team", awayKey),
      name: match.teams.away.name,
      badgeUrl: safeUrl(match.teams.away.badge),
    },
    homeScore: match.score?.current?.home ?? 0,
    awayScore: match.score?.current?.away ?? 0,
    status: normalizeStatus(match.status, match.status_detail),
    statusLabel: match.status_detail ?? match.status,
    venue: venueName(venue),
  });
}

export class SportSrcProvider implements SportsProvider {
  readonly name = "sportsrc";

  constructor(
    private readonly apiKey: string,
    private readonly client = new ResilientHttpClient(),
  ) {
    if (!apiKey.trim()) throw new Error("SPORTSRC_API_KEY_REQUIRED");
  }

  private async request(params: Record<string, string>): Promise<unknown> {
    const url = new URL(SPORTSRC_API_BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return this.client.json(url, { headers: { "X-API-KEY": this.apiKey } });
  }

  private async list(params: Record<string, string>): Promise<NormalizedSportsEvent[]> {
    const payload = listEnvelopeSchema.parse(await this.request({ type: "matches", sport: "football", ...params }));
    return payload.data.flatMap((group) => group.matches.flatMap((candidate) => {
      const parsed = matchSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn("[sportsrc] skipped malformed match", { reason: "SPORTSRC_SCHEMA_INVALID" });
        return [];
      }
      try {
        return [normalize(parsed.data, group.league)];
      } catch (error) {
        console.warn("[sportsrc] skipped invalid match", {
          matchId: parsed.data.id,
          reason: error instanceof Error && error.message.startsWith("SPORTSRC_")
            ? error.message
            : "SPORTSRC_NORMALIZATION_FAILED",
        });
        return [];
      }
    }));
  }

  eventsByDate(date: string) {
    const parsed = z.string().date().parse(date);
    return this.list({ date: parsed });
  }

  liveEvents() {
    return this.list({ status: "inprogress" }).then((events) =>
      events.filter((event) => ["live", "halftime", "paused"].includes(event.status)),
    );
  }

  async eventById(id: string) {
    if (!id.startsWith("sportsrc-")) return undefined;
    const externalId = id.slice("sportsrc-".length);
    if (!externalId) return undefined;
    try {
      const payload = detailEnvelopeSchema.parse(await this.request({ type: "detail", id: externalId }));
      return normalize(payload.data.match_info, undefined, payload.data.info?.venue);
    } catch (error) {
      if (error instanceof Error && error.message === "SPORTS_PROVIDER_404") return undefined;
      throw error;
    }
  }
}

export { normalizeStatus as normalizeSportSrcStatus };
