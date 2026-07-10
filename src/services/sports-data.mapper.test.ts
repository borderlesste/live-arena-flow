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

  it("deduplicates events, preserves phase metadata and prioritizes the primary stream", () => {
    const sources = [
      { id: "secondary", matchId: "event-1", createdAt: new Date().toISOString(), type: "hls", url: "https://cdn.example.com/secondary.m3u8", title: "Secundaria", isExternal: false, purpose: "live" },
      { id: "primary", matchId: "event-1", createdAt: new Date().toISOString(), type: "hls", url: "https://cdn.example.com/primary.m3u8", title: "Principal", isExternal: false, purpose: "live", isPrimary: true },
    ] as const;
    const bundle = mapSportsEvents([{ ...event, phase: "Final", group: "A", city: "São Paulo" }, { ...event }], [...sources]);

    expect(bundle.matches).toHaveLength(1);
    expect(bundle.matches[0]).toMatchObject({ phase: "Final", group: "A", city: "São Paulo" });
    expect(bundle.matches[0].streams.map((source) => source.id)).toEqual(["primary", "secondary"]);
    expect(bundle.competitions[0]).toMatchObject({ totalMatches: 1 });
  });

  it("discards every non-football event", () => {
    const foreignSport = { ...event, sport: "Basketball" } as unknown as NormalizedSportsEvent;
    expect(mapSportsEvents([foreignSport])).toEqual({ matches: [], teams: [], competitions: [] });
  });

  it("does not load an OBS manifest until the provider reports a live signal", () => {
    const source = {
      id: "source-obs",
      matchId: "event-1",
      createdAt: new Date().toISOString(),
      type: "obs_hls",
      url: "https://customer-example.cloudflarestream.com/input/manifest/video.m3u8",
      title: "OBS principal",
      isExternal: false,
      purpose: "live",
      sourceKind: "obs",
      status: "waiting_signal",
    } as const;

    expect(mapSportsEvents([event], [source]).matches[0].streams).toEqual([]);
    expect(mapSportsEvents([event], [{ ...source, status: "live" }]).matches[0]).toMatchObject({
      status: "live",
      streams: [expect.objectContaining({ id: "source-obs" })],
    });
  });

  it("does not use a past event date as nextEventAt", () => {
    const pastEvent: NormalizedSportsEvent = {
      ...event,
      id: "event-past",
      startsAt: "2020-01-01T12:00:00.000Z",
      competition: { id: "league-2", name: "Past League" },
      status: "finished",
    };

    const bundle = mapSportsEvents([pastEvent]);
    expect(bundle.competitions).toHaveLength(1);
    expect(bundle.competitions[0].nextEventAt).toBeUndefined();
  });
});
