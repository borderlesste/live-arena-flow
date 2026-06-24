import { format } from "date-fns";
import type { Match, MatchStatus, Sport } from "@/types";
import { getEventById, getEventsByDate } from "@/services/sports.service";
import { mapSportsEvents } from "@/services/sports-data.mapper";

export interface MatchesQuery {
  sport?: Sport | "all";
  status?: MatchStatus | "all";
  competitionId?: string;
  date?: string;
}

export async function listMatches(query: MatchesQuery = {}): Promise<Match[]> {
  const events = await getEventsByDate(query.date ?? format(new Date(), "yyyy-MM-dd"));
  return mapSportsEvents(events).matches.filter((match) => {
    if (query.sport && query.sport !== "all" && match.sport !== query.sport) return false;
    if (query.status && query.status !== "all" && match.status !== query.status) return false;
    if (query.competitionId && match.competitionId !== query.competitionId) return false;
    return true;
  });
}

export async function getMatchById(id: string): Promise<Match | undefined> {
  const event = await getEventById(id);
  return event ? mapSportsEvents([event]).matches[0] : undefined;
}

export async function getLiveMatches(): Promise<Match[]> {
  return listMatches({ status: "live" });
}

export async function getUpcomingMatches(): Promise<Match[]> {
  return (await listMatches({ status: "scheduled" })).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

export async function getFinishedMatches(): Promise<Match[]> {
  return (await listMatches({ status: "finished" })).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
}
