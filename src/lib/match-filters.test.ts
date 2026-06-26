import { describe, expect, it } from "vitest";
import { filterMatches } from "./match-filters";
import type { Match, MatchStatus } from "@/types";

function match(id: string, status: MatchStatus): Match {
  return { id, status, sport: "football", competitionId: "competition", homeTeamId: "home", awayTeamId: "away", homeScore: 0, awayScore: 0, startsAt: "2026-06-21T12:00:00.000Z", venue: "Arena", streams: [] };
}

const matches = [
  match("live", "live"),
  match("paused", "paused"),
  match("upcoming", "scheduled"),
  match("finished", "finished"),
];

describe("match filters", () => {
  it("returns only football (all filter)", () => {
    expect(filterMatches(matches, "all")).toHaveLength(4);
  });

  it("returns upcoming and finished records", () => {
    expect(filterMatches(matches, "upcoming").map((m) => m.id)).toEqual(["upcoming"]);
    expect(filterMatches(matches, "finished").map((m) => m.id)).toEqual(["finished"]);
  });

  it("treats paused matches as live", () => {
    expect(filterMatches(matches, "live").map((m) => m.id)).toEqual(["live", "paused"]);
  });

  it("football filter returns all football matches", () => {
    expect(filterMatches(matches, "football")).toHaveLength(4);
  });
});
