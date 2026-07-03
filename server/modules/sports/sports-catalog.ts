import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizedSportsEventSchema, type NormalizedSportsEvent } from "./sports-provider.js";
import type { LocalMatchInput } from "../../../src/schemas/local-match.schema.js";

const ACTIVE_STATUSES = ["live", "halftime", "paused"] as const;
const MATCH_SELECT = `
  id, external_id, provider, status, starts_at, venue, home_score, away_score, raw_payload,
  competition:competitions!matches_competition_id_fkey(
    id, external_id, name, region, logo_url,
    sport:sports!competitions_sport_id_fkey(slug)
  ),
  home_team:teams!matches_home_team_id_fkey(id, external_id, name, logo_url),
  away_team:teams!matches_away_team_id_fkey(id, external_id, name, logo_url)
`;

type Relation<T> = T | T[] | null;
interface SportRelation { slug: string }
interface CompetitionRelation {
  id: string;
  external_id: string | null;
  name: string;
  region: string | null;
  logo_url: string | null;
  sport: Relation<SportRelation>;
}
interface TeamRelation {
  id: string;
  external_id: string | null;
  name: string;
  logo_url: string | null;
}
interface CatalogMatchRow {
  id: string;
  external_id: string | null;
  provider: string;
  status: NormalizedSportsEvent["status"];
  starts_at: string;
  venue: string | null;
  home_score: number;
  away_score: number;
  raw_payload: Record<string, unknown> | null;
  competition: Relation<CompetitionRelation>;
  home_team: Relation<TeamRelation>;
  away_team: Relation<TeamRelation>;
}

function singleRelation<T>(value: Relation<T>): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function databaseTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("SPORTS_CATALOG_INVALID_TIMESTAMP");
  return parsed.toISOString();
}

function entityKey(prefix: string, value: string): string {
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("es");
  const readable = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `local-${prefix}-${readable || "item"}-${digest}`;
}

function eventFromRow(row: CatalogMatchRow): NormalizedSportsEvent | undefined {
  const competition = singleRelation(row.competition);
  const homeTeam = singleRelation(row.home_team);
  const awayTeam = singleRelation(row.away_team);
  const sport = singleRelation(competition?.sport ?? null);
  if (!row.external_id || !competition || !homeTeam || !awayTeam || sport?.slug !== "football") return undefined;
  const raw = row.raw_payload ?? {};
  return normalizedSportsEventSchema.parse({
    id: row.external_id,
    // PostgreSQL/PostgREST commonly serializes timestamptz with a +00:00
    // offset, while the public contract uses canonical ISO-8601 UTC (`Z`).
    startsAt: databaseTimestamp(row.starts_at),
    sport: "Football",
    competition: {
      id: competition.external_id ?? competition.id,
      name: competition.name,
      region: competition.region ?? undefined,
      badgeUrl: competition.logo_url ?? undefined,
    },
    homeTeam: {
      id: homeTeam.external_id ?? homeTeam.id,
      name: homeTeam.name,
      badgeUrl: homeTeam.logo_url ?? undefined,
    },
    awayTeam: {
      id: awayTeam.external_id ?? awayTeam.id,
      name: awayTeam.name,
      badgeUrl: awayTeam.logo_url ?? undefined,
    },
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    statusLabel: typeof raw.statusLabel === "string" ? raw.statusLabel : undefined,
    venue: row.venue ?? undefined,
    highlightUrl: typeof raw.highlightUrl === "string" ? raw.highlightUrl : undefined,
  });
}

function dateRange(date: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_SPORTS_DATE");
  const start = new Date(`${date}T00:00:00-03:00`);
  if (Number.isNaN(start.getTime())) throw new Error("INVALID_SPORTS_DATE");
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export interface SportsCatalog {
  syncProviderEvents(provider: string, events: NormalizedSportsEvent[]): Promise<void>;
  eventsByDate(date: string): Promise<NormalizedSportsEvent[]>;
  liveEvents(provider: string, currentProviderIds: string[]): Promise<NormalizedSportsEvent[]>;
  eventById(publicId: string): Promise<NormalizedSportsEvent | undefined>;
  findMatchUuid(publicId: string): Promise<string | undefined>;
  createLocalMatch(input: LocalMatchInput): Promise<NormalizedSportsEvent>;
}

export class SupabaseSportsCatalog implements SportsCatalog {
  constructor(private readonly client: SupabaseClient) {}

  private async footballSportId(): Promise<string> {
    const existing = await this.client.from("sports").select("id").eq("slug", "football").maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) return String(existing.data.id);
    const inserted = await this.client.from("sports").upsert({
      provider: "system",
      external_id: "football",
      slug: "football",
      name: "Fútbol",
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "slug" }).select("id").single();
    if (inserted.error) throw inserted.error;
    return String(inserted.data.id);
  }

  async syncProviderEvents(provider: string, events: NormalizedSportsEvent[]): Promise<void> {
    if (events.length === 0) return;
    const sportId = await this.footballSportId();
    const updatedAt = new Date().toISOString();
    const competitions = [...new Map(events.map((event) => [event.competition.id, event.competition])).values()];
    const teams = [...new Map(events.flatMap((event) => [[event.homeTeam.id, event.homeTeam] as const, [event.awayTeam.id, event.awayTeam] as const])).values()];

    const [competitionResult, teamResult] = await Promise.all([
      this.client.from("competitions").upsert(competitions.map((competition) => ({
        sport_id: sportId,
        provider,
        external_id: competition.id,
        name: competition.name,
        region: competition.region ?? null,
        logo_url: competition.badgeUrl ?? null,
        active: true,
        updated_at: updatedAt,
      })), { onConflict: "provider,external_id" }).select("id,external_id"),
      this.client.from("teams").upsert(teams.map((team) => ({
        sport_id: sportId,
        provider,
        external_id: team.id,
        name: team.name,
        short_name: team.name.slice(0, 40),
        logo_url: team.badgeUrl ?? null,
        updated_at: updatedAt,
      })), { onConflict: "provider,external_id" }).select("id,external_id"),
    ]);
    if (competitionResult.error) throw competitionResult.error;
    if (teamResult.error) throw teamResult.error;

    const competitionIds = new Map((competitionResult.data ?? []).map((row) => [String(row.external_id), String(row.id)]));
    const teamIds = new Map((teamResult.data ?? []).map((row) => [String(row.external_id), String(row.id)]));
    const rows = events.map((event) => ({
      competition_id: competitionIds.get(event.competition.id),
      home_team_id: teamIds.get(event.homeTeam.id),
      away_team_id: teamIds.get(event.awayTeam.id),
      provider,
      external_id: event.id,
      status: event.status,
      starts_at: event.startsAt,
      venue: event.venue ?? event.city ?? null,
      home_score: event.homeScore,
      away_score: event.awayScore,
      raw_payload: { statusLabel: event.statusLabel, highlightUrl: event.highlightUrl },
      deleted_at: null,
      updated_at: updatedAt,
    }));
    if (rows.some((row) => !row.competition_id || !row.home_team_id || !row.away_team_id)) throw new Error("SPORTS_CATALOG_RELATION_MISSING");
    const matchResult = await this.client.from("matches").upsert(rows, { onConflict: "provider,external_id" }).select("id,external_id");
    if (matchResult.error) throw matchResult.error;
  }

  async eventsByDate(date: string): Promise<NormalizedSportsEvent[]> {
    const range = dateRange(date);
    const result = await this.client.from("matches").select(MATCH_SELECT)
      .gte("starts_at", range.start).lt("starts_at", range.end)
      .is("deleted_at", null).order("starts_at", { ascending: true });
    if (result.error) throw result.error;
    return (result.data as unknown as CatalogMatchRow[]).flatMap((row) => eventFromRow(row) ?? []);
  }

  async liveEvents(provider: string, currentProviderIds: string[]): Promise<NormalizedSportsEvent[]> {
    const localQuery = this.client.from("matches").select(MATCH_SELECT)
      .eq("provider", "local").in("status", [...ACTIVE_STATUSES]).is("deleted_at", null);
    const providerQuery = currentProviderIds.length > 0
      ? this.client.from("matches").select(MATCH_SELECT).eq("provider", provider).in("external_id", currentProviderIds).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null });
    const [localResult, providerResult] = await Promise.all([localQuery, providerQuery]);
    if (localResult.error) throw localResult.error;
    if (providerResult.error) throw providerResult.error;
    const rows = [...(localResult.data ?? []), ...(providerResult.data ?? [])] as unknown as CatalogMatchRow[];
    return [...new Map(rows.flatMap((row) => {
      const event = eventFromRow(row);
      return event ? [[event.id, event] as const] : [];
    })).values()];
  }

  async eventById(publicId: string): Promise<NormalizedSportsEvent | undefined> {
    const result = await this.client.from("matches").select(MATCH_SELECT)
      .eq("external_id", publicId).is("deleted_at", null).limit(1).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? eventFromRow(result.data as unknown as CatalogMatchRow) : undefined;
  }

  async findMatchUuid(publicId: string): Promise<string | undefined> {
    const result = await this.client.from("matches").select("id").eq("external_id", publicId).is("deleted_at", null).limit(1).maybeSingle();
    if (result.error) throw result.error;
    return result.data?.id ? String(result.data.id) : undefined;
  }

  async createLocalMatch(input: LocalMatchInput): Promise<NormalizedSportsEvent> {
    const sportId = await this.footballSportId();
    const updatedAt = new Date().toISOString();
    const competitionExternalId = entityKey("competition", `${input.region}:${input.competitionName}`);
    const homeExternalId = entityKey("team", input.homeTeamName);
    const awayExternalId = entityKey("team", input.awayTeamName);
    const [competitionResult, homeResult, awayResult] = await Promise.all([
      this.client.from("competitions").upsert({
        sport_id: sportId, provider: "local", external_id: competitionExternalId,
        name: input.competitionName, region: input.region, active: true, updated_at: updatedAt,
      }, { onConflict: "provider,external_id" }).select("id").single(),
      this.client.from("teams").upsert({
        sport_id: sportId, provider: "local", external_id: homeExternalId,
        name: input.homeTeamName, short_name: input.homeTeamName.slice(0, 40), updated_at: updatedAt,
      }, { onConflict: "provider,external_id" }).select("id").single(),
      this.client.from("teams").upsert({
        sport_id: sportId, provider: "local", external_id: awayExternalId,
        name: input.awayTeamName, short_name: input.awayTeamName.slice(0, 40), updated_at: updatedAt,
      }, { onConflict: "provider,external_id" }).select("id").single(),
    ]);
    if (competitionResult.error) throw competitionResult.error;
    if (homeResult.error) throw homeResult.error;
    if (awayResult.error) throw awayResult.error;

    const matchUuid = randomUUID();
    const externalId = `local-${matchUuid}`;
    const inserted = await this.client.from("matches").insert({
      id: matchUuid,
      competition_id: competitionResult.data.id,
      home_team_id: homeResult.data.id,
      away_team_id: awayResult.data.id,
      provider: "local",
      external_id: externalId,
      status: "scheduled",
      starts_at: input.startsAt,
      venue: input.venue || null,
      home_score: 0,
      away_score: 0,
      raw_payload: { source: "admin" },
    }).select("id").single();
    if (inserted.error) throw inserted.error;
    const created = await this.eventById(externalId);
    if (!created) throw new Error("LOCAL_MATCH_NOT_FOUND_AFTER_CREATE");
    return created;
  }
}

export { databaseTimestamp, dateRange, entityKey, eventFromRow };
