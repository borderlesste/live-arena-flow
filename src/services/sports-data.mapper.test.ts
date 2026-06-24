import { describe, expect, it } from "vitest";
import { mapSportsEvents } from "@/services/sports-data.mapper";
import type { NormalizedSportsEvent } from "@/schemas/sports-event.schema";

const event: NormalizedSportsEvent = {
  id: "event-1", startsAt: "2026-06-20T20:00:00.000Z", sport: "Soccer",
  competition: { id: "league-1", name: "World Cup" },
  homeTeam: { id: "home-1", name: "Brazil" }, awayTeam: { id: "away-1", name: "Haiti" },
  homeScore: 3, awayScore: 0, status: "finished", venue: "Arena", highlightUrl: "https://www.youtube.com/watch?v=abc123",
};

describe("mapSportsEvents", () => {
  it("maps normalized provider events to UI domains", () => {
    const bundle = mapSportsEvents([event]);
    expect(bundle.matches[0]).toMatchObject({ id: "event-1", sport: "football", status: "finished", homeScore: 3, awayScore: 0 });
    expect(bundle.teams).toHaveLength(2);
    expect(bundle.competitions[0].name).toBe("World Cup");
    expect(bundle.matches[0].highlights?.[0].embedUrl).toBe("https://www.youtube-nocookie.com/embed/abc123");
  });

  it("adds managed sources without provider-specific fields", () => {
    const source = { id: "source-1", matchId: "event-1", createdAt: new Date().toISOString(), type: "hls", url: "https://cdn.example.com/live.m3u8", title: "OBS principal", isExternal: false, purpose: "live" } as const;
    expect(mapSportsEvents([event], [source]).matches[0].streams[0].title).toBe("OBS principal");
  });
});

