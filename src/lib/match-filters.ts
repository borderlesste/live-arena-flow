import type { MatchFilter } from "@/components/matches/MatchFilters";
import type { Match, MatchStatus } from "@/types";
import { getMatchLocalDateKey } from "@/lib/format";

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

export interface MatchFilterCriteria {
  status?: MatchFilter;
  competitionId?: string;
  localDate?: string;
}

export function filterMatchesByCriteria(matches: Match[], criteria: MatchFilterCriteria): Match[] {
  const byStatus = filterMatches(matches, criteria.status ?? "all");
  return byStatus.filter((match) => {
    if (criteria.competitionId && criteria.competitionId !== "all" && match.competitionId !== criteria.competitionId) return false;
    if (criteria.localDate && getMatchLocalDateKey(match.startsAt) !== criteria.localDate) return false;
    return true;
  });
}

export function matchStatusLabel(status: MatchStatus): string {
  switch (status) {
    case "live": return "En vivo";
    case "halftime": return "Descanso";
    case "paused": return "Pausado";
    case "scheduled": return "Próximo";
    case "finished": return "Finalizado";
    case "postponed": return "Pospuesto";
    case "cancelled": return "Cancelado";
    case "unknown": return "Estado por confirmar";
  }
}
