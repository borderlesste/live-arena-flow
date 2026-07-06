import { describe, expect, it } from "vitest";
import { sortCompetitionsByPriority } from "@/lib/format";
import type { Competition } from "@/types";

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
      createCompetition("c1", 0, "2026-07-10T12:00:00Z"),
      createCompetition("c2", 2, "2026-07-07T12:00:00Z"),
      createCompetition("c3", 2, "2026-07-08T12:00:00Z"),
      createCompetition("c4", 0, "2026-07-09T08:00:00Z"),
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
      createCompetition("c4", 0, "2026-07-08T09:00:00Z"),
    ];

    const sorted = sortCompetitionsByPriority(competitions);

    expect(sorted.map((c) => c.id)).toEqual(["c4", "c1", "c2", "c3"]);
  });
});
