import { describe, expect, it } from "vitest";
import { databaseTimestamp, dateRange, eventFromRow } from "./sports-catalog.js";

describe("sports catalog timestamps", () => {
  it("normalizes PostgreSQL timestamptz offsets to the public UTC contract", () => {
    expect(databaseTimestamp("2026-07-03T18:00:00+00:00")).toBe("2026-07-03T18:00:00.000Z");
  });

  it("maps persisted events without rejecting PostgREST timestamps", () => {
    const event = eventFromRow({
      id: "00000000-0000-4000-8000-000000000001",
      external_id: "sportsrc-egypt-australia-12813018",
      provider: "sportsrc",
      status: "scheduled",
      starts_at: "2026-07-03T18:00:00+00:00",
      venue: null,
      home_score: 0,
      away_score: 0,
      raw_payload: null,
      competition: {
        id: "00000000-0000-4000-8000-000000000002",
        external_id: "sportsrc-competition-world-cup",
        name: "World Championship",
        region: "World",
        logo_url: null,
        sport: { slug: "football" },
      },
      home_team: {
        id: "00000000-0000-4000-8000-000000000003",
        external_id: "sportsrc-team-egypt",
        name: "Egypt",
        logo_url: null,
      },
      away_team: {
        id: "00000000-0000-4000-8000-000000000004",
        external_id: "sportsrc-team-australia",
        name: "Australia",
        logo_url: null,
      },
    });

    expect(event?.startsAt).toBe("2026-07-03T18:00:00.000Z");
  });

  it("rejects irrecoverable timestamps explicitly", () => {
    expect(() => databaseTimestamp("not-a-date")).toThrow("SPORTS_CATALOG_INVALID_TIMESTAMP");
  });

  it("uses the same UTC day boundary as the SportSRC date endpoint", () => {
    expect(dateRange("2026-07-04")).toEqual({
      start: "2026-07-04T00:00:00.000Z",
      end: "2026-07-05T00:00:00.000Z",
    });
  });
});
