import { z } from "zod";
import { normalizedSportsEventSchema, ResilientHttpClient, type NormalizedSportsEvent, type SportsProvider } from "./sports-provider.js";

const identifier = z.union([z.string(), z.number()]).transform(String);
const score = z.union([z.string(), z.number()]).nullish().transform((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
});

const sportsDataGameSchema = z.object({
  GameId: identifier,
  DateTime: z.string().optional(),
  Day: z.string().optional(),
  Status: z.string().optional(),
  Clock: z.string().nullish(),
  HomeTeamId: identifier.optional(),
  HomeTeamKey: z.string().optional(),
  HomeTeamName: z.string().optional(),
  AwayTeamId: identifier.optional(),
  AwayTeamKey: z.string().optional(),
  AwayTeamName: z.string().optional(),
  HomeTeamScore: score,
  AwayTeamScore: score,
  CompetitionId: identifier.optional(),
  CompetitionName: z.string().optional(),
  Competition: z.string().optional(),
  RoundId: identifier.optional(),
  Group: z.string().nullish(),
  Venue: z.string().nullish(),
  VenueName: z.string().nullish(),
}).passthrough();

type SportsDataGame = z.infer<typeof sportsDataGameSchema>;

function formatSportsDataDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error("SPORTSDATAIO_INVALID_DATE");
  const month = value.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return `${value.getUTCFullYear()}-${month}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function normalizeStatus(value?: string): NormalizedSportsEvent["status"] {
  const status = value?.trim().toLowerCase().replace(/[\s_-]+/g, "") ?? "";
  if (["final", "finished", "closed", "f"].includes(status)) return "finished";
  if (["inprogress", "live", "halftime", "1h", "2h"].includes(status)) return status === "halftime" ? "halftime" : "live";
  if (["postponed", "delayed"].includes(status)) return "postponed";
  if (["canceled", "cancelled"].includes(status)) return "cancelled";
  if (["suspended", "interrupted"].includes(status)) return "paused";
  return "scheduled";
}

function normalizeDate(value: string | undefined): string {
  if (!value) return new Date(0).toISOString();
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function normalize(game: SportsDataGame): NormalizedSportsEvent {
  const competitionId = game.CompetitionId ?? game.RoundId ?? `sportsdata-competition-${game.GameId}`;
  const homeId = game.HomeTeamId ?? game.HomeTeamKey ?? `sportsdata-home-${game.GameId}`;
  const awayId = game.AwayTeamId ?? game.AwayTeamKey ?? `sportsdata-away-${game.GameId}`;
  return normalizedSportsEventSchema.parse({
    id: `sportsdata-${game.GameId}`,
    startsAt: normalizeDate(game.DateTime ?? game.Day),
    sport: "Soccer",
    competition: { id: competitionId, name: game.CompetitionName ?? game.Competition ?? game.Group ?? "Soccer" },
    homeTeam: { id: homeId, name: game.HomeTeamName ?? game.HomeTeamKey ?? `Team ${homeId}` },
    awayTeam: { id: awayId, name: game.AwayTeamName ?? game.AwayTeamKey ?? `Team ${awayId}` },
    homeScore: game.HomeTeamScore,
    awayScore: game.AwayTeamScore,
    status: normalizeStatus(game.Status),
    statusLabel: game.Clock ?? game.Status,
    venue: game.VenueName ?? game.Venue ?? undefined,
  });
}

export class SportSrcProvider implements SportsProvider {
  readonly name = "sportsdataio";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly eventsPath = "GamesByDate/{date}",
    private readonly authHeader = "Ocp-Apim-Subscription-Key",
    private readonly client = new ResilientHttpClient(),
    private readonly eventPath = "Game/{id}",
    private readonly liveEventsPath?: string,
  ) {}

  private headers() {
    return { [this.authHeader]: this.authHeader.toLowerCase() === "authorization" ? `Bearer ${this.apiKey}` : this.apiKey };
  }

  private async request(path: string): Promise<NormalizedSportsEvent[]> {
    const url = new URL(path.replace(/^\//, ""), this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    const payload = await this.client.json(url, { headers: this.headers() });
    const candidate = Array.isArray(payload) ? payload : (payload as { data?: unknown }).data ?? payload;
    const rows = Array.isArray(candidate) ? candidate : [candidate];
    return sportsDataGameSchema.array().parse(rows).map(normalize);
  }

  eventsByDate(date: string) {
    return this.request(this.eventsPath.replace("{date}", formatSportsDataDate(date)));
  }

  async liveEvents() {
    if (this.liveEventsPath) {
      return this.request(this.liveEventsPath).then((events) => events.filter((event) => ["live", "halftime", "paused"].includes(event.status)));
    }
    const dates = [-1, 0, 1].map((offset) => {
      const value = new Date();
      value.setUTCDate(value.getUTCDate() + offset);
      return value.toISOString().slice(0, 10);
    });
    const events = await Promise.all(dates.map((date) => this.eventsByDate(date)));
    return events.flat().filter((event) => ["live", "halftime", "paused"].includes(event.status));
  }

  async eventById(id: string) {
    if (!id.startsWith("sportsdata-")) return undefined;
    const externalId = id.replace(/^sportsdata-/, "");
    return (await this.request(this.eventPath.replace("{id}", encodeURIComponent(externalId))))[0];
  }
}

export { formatSportsDataDate };
