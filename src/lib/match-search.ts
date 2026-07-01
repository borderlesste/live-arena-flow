import type { Competition, Match, Team } from "@/types";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function matchesSearch(match: Match, teams: Team[], competitions: Competition[], query: string): boolean {
  const term = normalize(query.trim());
  if (!term) return true;
  const home = teams.find((team) => team.id === match.homeTeamId);
  const away = teams.find((team) => team.id === match.awayTeamId);
  const competition = competitions.find((item) => item.id === match.competitionId);
  return [home?.name, home?.shortName, away?.name, away?.shortName, competition?.name, competition?.region, match.venue]
    .some((value) => value && normalize(value).includes(term));
}

export interface MatchSearchResult {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function findMatchSearchResults(
  matches: Match[],
  teams: Team[],
  competitions: Competition[],
  query: string,
  limit = 6,
): MatchSearchResult[] {
  if (!query.trim() || limit <= 0) return [];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  const results: MatchSearchResult[] = [];

  for (const match of matches) {
    if (!matchesSearch(match, teams, competitions, query)) continue;
    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);
    const competition = competitionById.get(match.competitionId);
    if (!homeTeam || !awayTeam || !competition) continue;
    results.push({ match, homeTeam, awayTeam, competition });
    if (results.length >= limit) break;
  }
  return results;
}
