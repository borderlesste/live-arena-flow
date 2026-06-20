// Matches service — in-memory mock. Replace with API/edge-function fetch.
// NOTE: Server-side validation, auth and rate-limiting belong on the backend.

import { matches } from "@/data/mocks";
import type { Match, MatchStatus, Sport } from "@/types";

export interface MatchesQuery {
  sport?: Sport | "all";
  status?: MatchStatus | "all";
  competitionId?: string;
  date?: string; // ISO yyyy-MM-dd
}

export function listMatches(q: MatchesQuery = {}): Match[] {
  return matches.filter((m) => {
    if (q.sport && q.sport !== "all" && m.sport !== q.sport) return false;
    if (q.status && q.status !== "all" && m.status !== q.status) return false;
    if (q.competitionId && m.competitionId !== q.competitionId) return false;
    if (q.date) {
      const d = new Date(m.startsAt).toISOString().slice(0, 10);
      if (d !== q.date) return false;
    }
    return true;
  });
}

export function getMatchById(id: string): Match | undefined {
  return matches.find((m) => m.id === id);
}

export function getLiveMatches(): Match[] {
  return matches.filter((m) => m.status === "live" || m.status === "halftime" || m.status === "paused");
}

export function getUpcomingMatches(): Match[] {
  return matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

export function getFinishedMatches(): Match[] {
  return matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
}
