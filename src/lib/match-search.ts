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
