import type { Competition, Match, Team } from "@/types";

export function normalizeMatchSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
}

export function matchesSearch(match: Match, teams: Team[], competitions: Competition[], query: string): boolean {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  return matchesIndexedSearch(match, teamById, competitionById, query);
}

function matchesIndexedSearch(
  match: Match,
  teamById: Map<string, Team>,
  competitionById: Map<string, Competition>,
  query: string,
): boolean {
  const term = normalizeMatchSearchText(query);
  if (!term) return true;
  const home = teamById.get(match.homeTeamId);
  const away = teamById.get(match.awayTeamId);
  const competition = competitionById.get(match.competitionId);
  return [
    home?.name, home?.shortName, away?.name, away?.shortName,
    competition?.name, competition?.region, match.venue, match.city, match.phase, match.group,
  ].some((value) => value && normalizeMatchSearchText(value).includes(term));
}

export function searchMatches(
  matches: Match[],
  teams: Team[],
  competitions: Competition[],
  query: string,
): Match[] {
  const term = normalizeMatchSearchText(query);
  if (!term) return matches;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  return matches.filter((match) => matchesIndexedSearch(match, teamById, competitionById, term));
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

  for (const match of searchMatches(matches, teams, competitions, query)) {
    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);
    const competition = competitionById.get(match.competitionId);
    if (!homeTeam || !awayTeam || !competition) continue;
    results.push({ match, homeTeam, awayTeam, competition });
    if (results.length >= limit) break;
  }
  return results;
}
