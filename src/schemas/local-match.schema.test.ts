import { describe, expect, it } from "vitest";
import { localMatchInputSchema } from "./local-match.schema";

const valid = {
  competitionName: "Liga comunitaria",
  region: "República Dominicana",
  homeTeamName: "Atlético Norte",
  awayTeamName: "Deportivo Sur",
  startsAt: "2026-07-10T20:00:00.000Z",
  venue: "Cancha municipal",
};

describe("localMatchInputSchema", () => {
  it("accepts a valid football match", () => {
    expect(localMatchInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects the same team on both sides after Unicode normalization", () => {
    const result = localMatchInputSchema.safeParse({ ...valid, awayTeamName: "ATLÉTICO NORTE" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dates and oversized fields", () => {
    expect(localMatchInputSchema.safeParse({ ...valid, startsAt: "mañana", venue: "x".repeat(161) }).success).toBe(false);
  });
});
