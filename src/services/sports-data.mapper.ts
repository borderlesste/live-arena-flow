import type { Competition, Match, Sport, Team } from "@/types";
import type { NormalizedSportsEvent } from "@/schemas/sports-event.schema";
import type { ManagedVideoSource } from "@/services/video-sources.service";

export interface SportsDataBundle { matches: Match[]; teams: Team[]; competitions: Competition[] }

export function mergeSportsDataBundles(...bundles: SportsDataBundle[]): SportsDataBundle {
  const matches = new Map<string, Match>();
  const teams = new Map<string, Team>();
  const competitions = new Map<string, Competition>();

  for (const bundle of bundles) {
    for (const match of bundle.matches) matches.set(match.id, match);
    for (const team of bundle.teams) teams.set(team.id, team);
    for (const competition of bundle.competitions) competitions.set(competition.id, competition);
  }

  return {
    matches: [...matches.values()],
    teams: [...teams.values()],
    competitions: [...competitions.values()],
  };
}

export function dedupeSportsEvents(events: NormalizedSportsEvent[]): NormalizedSportsEvent[] {
  const unique = new Map<string, NormalizedSportsEvent>();
  for (const event of events) {
    const existing = unique.get(event.id);
    unique.set(event.id, existing ? {
      ...existing,
      ...event,
      city: event.city ?? existing.city,
      phase: event.phase ?? existing.phase,
      group: event.group ?? existing.group,
      venue: event.venue ?? existing.venue,
      highlightUrl: event.highlightUrl ?? existing.highlightUrl,
    } : event);
  }
  return [...unique.values()];
}

function colorFor(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${Math.abs(hash) % 360} 72% 56%`;
}

function monogram(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : value.slice(0, 2)).toUpperCase();
}

function shortName(value: string): string { return value.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "TBD"; }

/** Returns "football" for soccer/football events, null for everything else (discarded). */
function mapSport(value: string): Sport | null {
  switch (value.toLowerCase()) {
    case "soccer": case "football": return "football";
    default: return null;
  }
}

function youtubeEmbed(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : value;
  } catch { return value; }
}

export function mapSportsEvents(events: NormalizedSportsEvent[], videoSources: ManagedVideoSource[] = []): SportsDataBundle {
  const teams = new Map<string, Team>();
  const competitions = new Map<string, Competition>();

  const parseFutureDate = (value?: string): number | null => {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) || timestamp <= Date.now() ? null : timestamp;
  };

  const pickNextEventAt = (existing?: string, candidate?: string): string | undefined => {
    const existingTimestamp = parseFutureDate(existing);
    const candidateTimestamp = parseFutureDate(candidate);

    if (existingTimestamp === null && candidateTimestamp === null) return undefined;
    if (existingTimestamp === null) return candidate;
    if (candidateTimestamp === null) return existing;
    return existingTimestamp <= candidateTimestamp ? existing : candidate;
  };

  const matches = dedupeSportsEvents(events)
    .map((event): Match | null => {
      const sport = mapSport(event.sport);
      if (!sport) return null; // discard non-football events

      teams.set(event.homeTeam.id, {
        id: event.homeTeam.id, name: event.homeTeam.name, shortName: shortName(event.homeTeam.name),
        monogram: monogram(event.homeTeam.name), color: colorFor(event.homeTeam.id), badgeUrl: event.homeTeam.badgeUrl,
      });
      teams.set(event.awayTeam.id, {
        id: event.awayTeam.id, name: event.awayTeam.name, shortName: shortName(event.awayTeam.name),
        monogram: monogram(event.awayTeam.name), color: colorFor(event.awayTeam.id), badgeUrl: event.awayTeam.badgeUrl,
      });

      const existing = competitions.get(event.competition.id);
      competitions.set(event.competition.id, {
        id: event.competition.id, name: event.competition.name, region: event.competition.region ?? "Internacional", sport,
        monogram: monogram(event.competition.name), color: colorFor(event.competition.id), badgeUrl: event.competition.badgeUrl,
        activeMatches: (existing?.activeMatches ?? 0) + (event.status === "live" ? 1 : 0),
        totalMatches: (existing?.totalMatches ?? 0) + 1,
        nextEventAt: pickNextEventAt(existing?.nextEventAt, event.startsAt),
      });

      const managedSources = videoSources
        .filter((source) => source.matchId === event.id && source.isEnabled !== false)
        .sort((left, right) => Number(right.isPrimary === true) - Number(left.isPrimary === true));

      // Only include streams that have a playable URL — OBS sources without
      // STREAM_PLAYBACK_BASE_URL configured won't have a URL yet.
      const playerStreams = managedSources
        .filter((source) => source.purpose !== "highlight" && (
          source.coverImageUrl || (
            (source.url || source.embedUrl) &&
            (source.sourceKind !== "obs" || source.status === "live")
          )
        ))
        .map((source) => ({
          ...source,
          isPlayable: Boolean(
            (source.url || source.embedUrl) &&
            (source.sourceKind !== "obs" || source.status === "live"),
          ),
        }));

      // If any OBS source for this match is actively live (detected via MediaMTX),
      // promote the match status to "live" regardless of what the sports API says.
      const hasActiveObsSource = managedSources.some(
        (source) => source.sourceKind === "obs" && source.isEnabled !== false &&
          source.status === "live",
      );
      const effectiveStatus = hasActiveObsSource ? "live" : event.status;
      const apiHighlight = event.highlightUrl
        ? [{ id: `provider-video-${event.id}`, type: "youtube" as const, embedUrl: youtubeEmbed(event.highlightUrl), title: "Highlight oficial", isExternal: true, requiresConsent: true, provider: "youtube" as const, purpose: "highlight" as const }]
        : [];
      const highlights = [...apiHighlight, ...managedSources.filter((source) => source.purpose === "highlight")];

      return {
        id: event.id, sport, competitionId: event.competition.id,
        homeTeamId: event.homeTeam.id, awayTeamId: event.awayTeam.id,
        homeScore: event.homeScore, awayScore: event.awayScore, status: effectiveStatus,
        clock: effectiveStatus === "live" ? event.statusLabel ?? "En vivo" : undefined,
        startsAt: event.startsAt, venue: event.venue ?? event.city ?? "Sede por confirmar",
        city: event.city, phase: event.phase, group: event.group,
        streams: playerStreams, highlights,
        hasReplay: managedSources.some((source) => source.purpose === "highlight"),
        hasSummary: highlights.length > 0,
      };
    })
    .filter((m): m is Match => m !== null);

  return { matches, teams: [...teams.values()], competitions: [...competitions.values()] };
}
