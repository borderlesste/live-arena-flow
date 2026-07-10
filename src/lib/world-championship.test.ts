import { describe, expect, it } from "vitest";
import {
  classifyWorldChampionshipPhase,
  filterWorldChampionshipMatches,
  groupWorldChampionshipMatchesByPhase,
  isWorldChampionshipCompetition,
  splitWorldChampionshipTimeline,
  WORLD_CHAMPIONSHIP_NAME,
} from "@/lib/world-championship";
import type { Competition, Match } from "@/types";

function createMatch(id: string, startsAt: string, status: Match["status"], competitionId = "sportsrc-competition-world-cup"): Match {
  return {
    id,
    sport: "football",
    competitionId,
    homeTeamId: "home",
    awayTeamId: "away",
    homeScore: status === "finished" ? 2 : 0,
    awayScore: status === "finished" ? 1 : 0,
    status,
    startsAt,
    venue: "Arena",
    streams: [],
  };
}

const worldCompetition: Competition = {
  id: "sportsrc-competition-world-cup",
  name: WORLD_CHAMPIONSHIP_NAME,
  region: "World",
  sport: "football",
  monogram: "WC",
  color: "10 70% 50%",
  activeMatches: 0,
  totalMatches: 0,
};

const leagueCompetition: Competition = {
  id: "league-1",
  name: "Premier League",
  region: "England",
  sport: "football",
  monogram: "PL",
  color: "220 70% 50%",
  activeMatches: 0,
  totalMatches: 0,
};

describe("isWorldChampionshipCompetition", () => {
  it("matches by canonical competition name", () => {
    expect(isWorldChampionshipCompetition(worldCompetition)).toBe(true);
  });

  it("matches by known provider id hints", () => {
    expect(isWorldChampionshipCompetition({ id: "sportsrc-competition-world-cup", name: "Other" })).toBe(true);
  });

  it("does not match unrelated competitions", () => {
    expect(isWorldChampionshipCompetition(leagueCompetition)).toBe(false);
  });
});

describe("filterWorldChampionshipMatches", () => {
  it("keeps only World Championship fixtures", () => {
    const matches = [
      createMatch("wc-1", "2026-07-08T18:00:00.000Z", "scheduled"),
      createMatch("league-1", "2026-07-08T20:00:00.000Z", "scheduled", "league-1"),
    ];

    expect(filterWorldChampionshipMatches(matches, [worldCompetition, leagueCompetition]).map((match) => match.id)).toEqual(["wc-1"]);
  });
});

describe("World Championship phases", () => {
  it("classifies provider phase labels and keeps the tournament order", () => {
    const matches = [
      { ...createMatch("final", "2026-07-19T19:00:00.000Z", "scheduled"), phase: "Final" },
      { ...createMatch("group", "2026-06-11T19:00:00.000Z", "finished"), phase: "Group Stage", group: "Group A" },
      { ...createMatch("semi", "2026-07-14T19:00:00.000Z", "scheduled"), phase: "Semi-finals" },
      { ...createMatch("r32", "2026-06-28T19:00:00.000Z", "scheduled"), phase: "Round of 32" },
    ];

    expect(classifyWorldChampionshipPhase(matches[1])).toBe("group-stage");
    expect(groupWorldChampionshipMatchesByPhase(matches).map((phase) => phase.key)).toEqual([
      "group-stage",
      "round-of-32",
      "semi-finals",
      "final",
    ]);
  });

  it("does not infer a phase when the provider did not supply one", () => {
    expect(classifyWorldChampionshipPhase(createMatch("unknown", "2026-07-01T19:00:00.000Z", "scheduled"))).toBe("other");
  });
});

describe("splitWorldChampionshipTimeline", () => {
  const now = new Date("2026-07-08T15:00:00.000Z");

  it("places finished matches in past (most recent first)", () => {
    const timeline = splitWorldChampionshipTimeline([
      createMatch("older", "2026-07-06T18:00:00.000Z", "finished"),
      createMatch("newer", "2026-07-07T18:00:00.000Z", "finished"),
    ], now);

    expect(timeline.past.map((match) => match.id)).toEqual(["newer", "older"]);
    expect(timeline.present).toEqual([]);
    expect(timeline.future).toEqual([]);
  });

  it("prioritizes live matches in present, then today's scheduled fixtures", () => {
    const timeline = splitWorldChampionshipTimeline([
      createMatch("live", "2026-07-08T14:00:00.000Z", "live"),
      createMatch("today", "2026-07-08T20:00:00.000Z", "scheduled"),
      createMatch("tomorrow", "2026-07-09T18:00:00.000Z", "scheduled"),
    ], now);

    expect(timeline.present.map((match) => match.id)).toEqual(["live", "today"]);
    expect(timeline.future.map((match) => match.id)).toEqual(["tomorrow"]);
  });

  it("uses the next upcoming match as present when nothing is live or scheduled today", () => {
    const timeline = splitWorldChampionshipTimeline([
      createMatch("past", "2026-07-06T18:00:00.000Z", "finished"),
      createMatch("next", "2026-07-09T18:00:00.000Z", "scheduled"),
      createMatch("later", "2026-07-10T18:00:00.000Z", "scheduled"),
    ], now);

    expect(timeline.present.map((match) => match.id)).toEqual(["next"]);
    expect(timeline.future.map((match) => match.id)).toEqual(["later"]);
  });
});
