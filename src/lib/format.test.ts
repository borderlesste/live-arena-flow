import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import {
  getMatchLocalDateKey,
  groupEventsByLocalDate,
  groupMatchesByDate,
  sortCompetitionsByPriority,
  sortEventsByStartTimeAsc,
  sortEventsByStartTimeDesc,
} from "@/lib/format";
import type { Competition, Match } from "@/types";

function createMatch(id: string, startsAt: string, status: Match["status"] = "scheduled"): Match {
  return {
    id,
    sport: "football",
    competitionId: "competition",
    homeTeamId: "home",
    awayTeamId: "away",
    homeScore: 0,
    awayScore: 0,
    status,
    startsAt,
    venue: "Arena",
    streams: [],
  };
}

function createCompetition(id: string, activeMatches: number | string, nextEventAt: string | null) {
  return {
    id,
    name: `Comp ${id}`,
    region: "España",
    sport: "football",
    monogram: "XX",
    color: "10 70% 50%",
    activeMatches,
    nextEventAt,
  } as Competition;
}

describe("sortCompetitionsByPriority", () => {
  it("orders active competitions first and then by next event timestamp", () => {
    const competitions = [
      createCompetition("c1", 0, "2027-07-10T12:00:00Z"),
      createCompetition("c2", 2, "2027-07-07T12:00:00Z"),
      createCompetition("c3", 2, "2027-07-08T12:00:00Z"),
      createCompetition("c4", 0, "2027-07-09T08:00:00Z"),
      createCompetition("c5", "invalid", null),
    ];

    const sorted = sortCompetitionsByPriority(competitions);

    expect(sorted.map((c) => c.id)).toEqual(["c2", "c3", "c4", "c1", "c5"]);
  });

  it("places competitions without valid dates or past dates at the end while preserving stable order", () => {
    const competitions = [
      createCompetition("c1", 0, null),
      createCompetition("c2", 0, "invalid"),
      createCompetition("c3", 0, "2024-07-08T09:00:00Z"),
      createCompetition("c4", 0, "2027-07-08T09:00:00Z"),
    ];

    const sorted = sortCompetitionsByPriority(competitions);

    expect(sorted.map((c) => c.id)).toEqual(["c4", "c1", "c2", "c3"]);
  });
});

describe("getMatchLocalDateKey", () => {
  it("returns the local calendar day in yyyy-MM-dd format", () => {
    const iso = "2026-07-08T22:00:00.000Z";
    expect(getMatchLocalDateKey(iso)).toBe(format(new Date(iso), "yyyy-MM-dd"));
  });
});

describe("groupMatchesByDate", () => {
  it("groups upcoming matches in ascending date order", () => {
    const matches = [
      createMatch("later", "2026-07-10T18:00:00.000Z"),
      createMatch("earlier", "2026-07-08T18:00:00.000Z"),
      createMatch("middle", "2026-07-09T12:00:00.000Z"),
    ];

    const groups = groupMatchesByDate(matches, { order: "asc" });

    expect(groups.map((group) => group.key)).toEqual([
      getMatchLocalDateKey("2026-07-08T18:00:00.000Z"),
      getMatchLocalDateKey("2026-07-09T12:00:00.000Z"),
      getMatchLocalDateKey("2026-07-10T18:00:00.000Z"),
    ]);
    expect(groups[0]?.matches.map((match) => match.id)).toEqual(["earlier"]);
  });

  it("groups finished matches in descending date order", () => {
    const matches = [
      createMatch("older", "2026-07-08T18:00:00.000Z", "finished"),
      createMatch("newer", "2026-07-10T18:00:00.000Z", "finished"),
    ];

    const groups = groupMatchesByDate(matches, { order: "desc" });

    expect(groups.map((group) => group.key)).toEqual([
      getMatchLocalDateKey("2026-07-10T18:00:00.000Z"),
      getMatchLocalDateKey("2026-07-08T18:00:00.000Z"),
    ]);
  });

  it("exports route-neutral aliases for sports event lists", () => {
    const matches = [
      createMatch("later", "2026-07-10T18:00:00.000Z"),
      createMatch("earlier", "2026-07-08T18:00:00.000Z"),
    ];

    expect(sortEventsByStartTimeAsc(matches).map((match) => match.id)).toEqual(["earlier", "later"]);
    expect(sortEventsByStartTimeDesc(matches).map((match) => match.id)).toEqual(["later", "earlier"]);
    expect(groupEventsByLocalDate(matches, { order: "asc" }).map((group) => group.key)).toEqual([
      getMatchLocalDateKey("2026-07-08T18:00:00.000Z"),
      getMatchLocalDateKey("2026-07-10T18:00:00.000Z"),
    ]);
  });
});
