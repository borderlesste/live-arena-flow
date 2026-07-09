import { format } from "date-fns";
import type { Competition, Match } from "@/types";
import { getMatchLocalDateKey, sortMatchesByDateAsc, sortMatchesByDateDesc } from "@/lib/format";

export const WORLD_CHAMPIONSHIP_NAME = "World Championship";

/** Known provider IDs / slugs for the World Championship competition. */
export const WORLD_CHAMPIONSHIP_ID_HINTS = [
  "sportsrc-competition-world-cup",
  "world-cup",
  "world-championship",
] as const;

const LIVE_STATUSES = new Set<Match["status"]>(["live", "halftime", "paused"]);

function normalizeCompetitionName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function isWorldChampionshipCompetition(
  competition: Pick<Competition, "id" | "name">,
): boolean {
  if (normalizeCompetitionName(competition.name) === normalizeCompetitionName(WORLD_CHAMPIONSHIP_NAME)) {
    return true;
  }
  const id = competition.id.toLowerCase();
  return WORLD_CHAMPIONSHIP_ID_HINTS.some((hint) => id.includes(hint));
}

export function filterWorldChampionshipMatches(
  matches: Match[],
  competitions: Competition[],
): Match[] {
  const competitionIds = new Set(
    competitions.filter(isWorldChampionshipCompetition).map((competition) => competition.id),
  );
  if (competitionIds.size === 0) return [];
  return matches.filter((match) => competitionIds.has(match.competitionId));
}

export interface WorldChampionshipTimeline {
  past: Match[];
  present: Match[];
  future: Match[];
}

export function splitWorldChampionshipTimeline(
  matches: Match[],
  now: Date = new Date(),
): WorldChampionshipTimeline {
  const todayKey = format(now, "yyyy-MM-dd");

  const past = sortMatchesByDateDesc(matches.filter((match) => match.status === "finished"));

  const live = sortMatchesByDateAsc(matches.filter((match) => LIVE_STATUSES.has(match.status)));
  const todayScheduled = sortMatchesByDateAsc(
    matches.filter(
      (match) => match.status === "scheduled" && getMatchLocalDateKey(match.startsAt) === todayKey,
    ),
  );

  const present: Match[] = [];
  const seen = new Set<string>();

  for (const match of [...live, ...todayScheduled]) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    present.push(match);
  }

  if (present.length === 0) {
    const nextUpcoming = sortMatchesByDateAsc(matches.filter((match) => match.status === "scheduled"))[0];
    if (nextUpcoming) present.push(nextUpcoming);
  }

  const presentIds = new Set(present.map((match) => match.id));
  const future = sortMatchesByDateAsc(
    matches.filter((match) => match.status === "scheduled" && !presentIds.has(match.id)),
  );

  return { past, present, future };
}
