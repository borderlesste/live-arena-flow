import type { MatchFilter } from "@/components/matches/MatchFilters";
import type { Match, MatchStatus } from "@/types";

export const LIVE_MATCH_STATUSES = ["live", "halftime", "paused"] as const satisfies MatchStatus[];

const LIVE_STATUS_SET = new Set<MatchStatus>(LIVE_MATCH_STATUSES);

export function isLiveMatchStatus(status: MatchStatus): boolean {
  return LIVE_STATUS_SET.has(status);
}

export function isUpcomingMatchStatus(status: MatchStatus): boolean {
  return status === "scheduled";
}

export function isFinishedMatchStatus(status: MatchStatus): boolean {
  return status === "finished";
}

export function filterLiveEvents(matches: Match[]): Match[] {
  return matches.filter((match) => isLiveMatchStatus(match.status));
}

export function filterUpcomingEvents(matches: Match[]): Match[] {
  return matches.filter((match) => isUpcomingMatchStatus(match.status));
}

export function filterFinishedEvents(matches: Match[]): Match[] {
  return matches.filter((match) => isFinishedMatchStatus(match.status));
}

export function filterMatches(matches: Match[], filter: MatchFilter): Match[] {
  if (filter === "live") return filterLiveEvents(matches);
  if (filter === "upcoming") return filterUpcomingEvents(matches);
  if (filter === "finished") return filterFinishedEvents(matches);
  // "all" and "football" both show football only — it's the only sport
  return matches.filter((match) => match.sport === "football");
}
