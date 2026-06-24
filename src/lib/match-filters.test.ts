import { describe, expect, it } from "vitest";
import { filterMatches } from "./match-filters";
import type { Match, MatchStatus, Sport } from "@/types";

function match(id: string, status: MatchStatus, sport: Sport): Match {
  return { id, status, sport, competitionId: "competition", homeTeamId: "home", awayTeamId: "away", homeScore: 0, awayScore: 0, startsAt: "2026-06-21T12:00:00.000Z", venue: "Arena", streams: [] };
}

const matches = [
  match("live", "live", "football"),
  match("paused", "paused", "basketball"),
  match("upcoming", "scheduled", "baseball"),
  match("finished", "finished", "volleyball"),
];

describe("match filters", () => {
  it("returns upcoming and finished API records", () => {
    expect(filterMatches(matches, "upcoming").map((item) => item.id)).toEqual(["upcoming"]);
    expect(filterMatches(matches, "finished").map((item) => item.id)).toEqual(["finished"]);
  });

  it("applies sports across every match status", () => {
    expect(filterMatches(matches, "volleyball").map((item) => item.id)).toEqual(["finished"]);
  });

  it("treats paused matches as live", () => {
    expect(filterMatches(matches, "live").map((item) => item.id)).toEqual(["live", "paused"]);
  });
});
