import { describe, expect, it } from "vitest";
import { findMatchSearchResults, matchesSearch } from "@/lib/match-search";
import type { Competition, Match, Team } from "@/types";

const teams: Team[] = [
  { id: "home", name: "Bahía Athletic", shortName: "BAH", monogram: "BA", color: "200 70% 50%" },
  { id: "away", name: "Capital Stars", shortName: "CAP", monogram: "CS", color: "20 70% 50%" },
];
const competitions: Competition[] = [{ id: "league", name: "Copa Internacional", region: "España", sport: "football", monogram: "CI", color: "10 70% 50%", activeMatches: 0 }];
const match: Match = { id: "match", sport: "football", competitionId: "league", homeTeamId: "home", awayTeamId: "away", homeScore: 0, awayScore: 0, status: "scheduled", startsAt: "2026-06-20T20:00:00Z", venue: "Estadio Central", streams: [] };

describe("matchesSearch", () => {
  it("encuentra equipos ignorando acentos y mayúsculas", () => expect(matchesSearch(match, teams, competitions, "BAHIA")).toBe(true));
  it("encuentra competición, región y sede", () => {
    expect(matchesSearch(match, teams, competitions, "internacional")).toBe(true);
    expect(matchesSearch(match, teams, competitions, "espana")).toBe(true);
    expect(matchesSearch(match, teams, competitions, "central")).toBe(true);
  });
  it("rechaza términos ausentes", () => expect(matchesSearch(match, teams, competitions, "Barcelona")).toBe(false));

  it("devuelve sugerencias completas y limita resultados", () => {
    const results = findMatchSearchResults([match, { ...match, id: "match-2" }], teams, competitions, "capital", 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      match: { id: "match" },
      homeTeam: { id: "home" },
      awayTeam: { id: "away" },
      competition: { id: "league" },
    });
  });
});
