// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CachedSportsProvider, FallbackSportsProvider, ResilientHttpClient, type NormalizedSportsEvent, type SportsProvider } from "./sports-provider.js";
import { TheSportsDbProvider } from "./thesportsdb.provider.js";
import { formatSportsDataDate, SportSrcProvider } from "./sportsrc.provider.js";

const event: NormalizedSportsEvent = {
  id: "event-1", startsAt: "2026-06-21T12:00:00.000Z", sport: "Soccer",
  competition: { id: "league-1", name: "League" }, homeTeam: { id: "home", name: "Home" }, awayTeam: { id: "away", name: "Away" },
  homeScore: 0, awayScore: 0, status: "scheduled",
};

describe("CachedSportsProvider", () => {
  it("does not spend provider quota twice within the TTL", async () => {
    const eventsByDate = vi.fn(async () => [event]);
    const provider: SportsProvider = { name: "test", eventsByDate, liveEvents: async () => [event], eventById: async () => event };
    const cached = new CachedSportsProvider(provider, 60_000);
    await cached.eventsByDate("2026-06-21");
    await cached.eventsByDate("2026-06-21");
    expect(eventsByDate).toHaveBeenCalledTimes(1);
  });

  it("refreshes live events with a shorter cache", async () => {
    const liveEvents = vi.fn(async () => [event]);
    const provider: SportsProvider = { name: "test", eventsByDate: async () => [event], liveEvents, eventById: async () => event };
    const cached = new CachedSportsProvider(provider, 60_000);
    await cached.liveEvents();
    await cached.liveEvents();
    expect(liveEvents).toHaveBeenCalledTimes(1);
  });
});

describe("FallbackSportsProvider", () => {
  it("uses the secondary provider when the primary fails", async () => {
    const primary: SportsProvider = {
      name: "primary",
      eventsByDate: vi.fn().mockRejectedValue(new Error("offline")),
      liveEvents: vi.fn().mockRejectedValue(new Error("offline")),
      eventById: vi.fn().mockRejectedValue(new Error("offline")),
    };
    const secondary: SportsProvider = {
      name: "secondary",
      eventsByDate: vi.fn(async () => [event]),
      liveEvents: vi.fn(async () => [event]),
      eventById: vi.fn(async () => event),
    };
    const provider = new FallbackSportsProvider(primary, secondary);

    await expect(provider.eventsByDate("2026-06-21")).resolves.toEqual([event]);
    await expect(provider.liveEvents()).resolves.toEqual([event]);
    await expect(provider.eventById("event-1")).resolves.toEqual(event);
    expect(secondary.eventsByDate).toHaveBeenCalledOnce();
    expect(secondary.liveEvents).toHaveBeenCalledOnce();
    expect(secondary.eventById).toHaveBeenCalledOnce();
  });

  it("uses the secondary provider when the primary has no usable content", async () => {
    const primary: SportsProvider = {
      name: "primary",
      eventsByDate: vi.fn(async () => []),
      liveEvents: vi.fn(async () => []),
      eventById: vi.fn(async () => undefined),
    };
    const secondary: SportsProvider = {
      name: "secondary",
      eventsByDate: vi.fn(async () => [event]),
      liveEvents: vi.fn(async () => [event]),
      eventById: vi.fn(async () => event),
    };
    const provider = new FallbackSportsProvider(primary, secondary);

    await expect(provider.eventsByDate("2026-06-21")).resolves.toEqual([event]);
    await expect(provider.liveEvents()).resolves.toEqual([event]);
    await expect(provider.eventById("event-1")).resolves.toEqual(event);
  });

  it("does not call the secondary provider when the primary has content", async () => {
    const secondaryEvents = vi.fn(async () => [event]);
    const secondaryLiveEvents = vi.fn(async () => [event]);
    const secondaryEvent = vi.fn(async () => event);
    const provider = new FallbackSportsProvider(
      { name: "primary", eventsByDate: async () => [event], liveEvents: async () => [event], eventById: async () => event },
      { name: "secondary", eventsByDate: secondaryEvents, liveEvents: secondaryLiveEvents, eventById: secondaryEvent },
    );

    await provider.eventsByDate("2026-06-21");
    await provider.liveEvents();
    await provider.eventById("event-1");
    expect(secondaryEvents).not.toHaveBeenCalled();
    expect(secondaryLiveEvents).not.toHaveBeenCalled();
    expect(secondaryEvent).not.toHaveBeenCalled();
  });
});

describe("ResilientHttpClient", () => {
  it("retries recoverable upstream responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new ResilientHttpClient(1_000, 2);
    await expect(client.json(new URL("https://provider.example/events"))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("does not retry non-recoverable client errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new ResilientHttpClient(1_000, 3);
    await expect(client.json(new URL("https://provider.example/events"))).rejects.toThrow("SPORTS_PROVIDER_403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});

describe("TheSportsDbProvider", () => {
  it("tolerates empty optional URLs from the upstream API", async () => {
    const payload = JSON.stringify({ events: [{
      idEvent: "event-1", strTimestamp: "2026-06-21T12:00:00Z", strSport: "Soccer", idLeague: "league-1",
      strLeague: "League", idHomeTeam: "home", strHomeTeam: "Home", idAwayTeam: "away", strAwayTeam: "Away",
      strLeagueBadge: "", strHomeTeamBadge: "", strAwayTeamBadge: "", strVideo: "",
    }] });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(payload, { status: 200, headers: { "Content-Type": "application/json" } }));
    const events = await new TheSportsDbProvider("test", new ResilientHttpClient()).eventsByDate("2026-06-21");
    expect(events[0]).toMatchObject({ id: "event-1", status: "scheduled" });
    expect(events[0].homeTeam.badgeUrl).toBeUndefined();
    // Only Soccer is queried now (football-only platform)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("s"))).toEqual(["Soccer"]);
    fetchMock.mockRestore();
  });

  it("does not request IDs owned by SportsDataIO", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(new TheSportsDbProvider("test").eventById("sportsdata-42")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("normalizes provider in-play status codes from the date endpoint", async () => {
    const payload = JSON.stringify({ events: [{
      idEvent: "basketball-live", strTimestamp: "2026-06-21T12:00:00Z", strSport: "Basketball", idLeague: "league-1",
      strLeague: "League", idHomeTeam: "home", strHomeTeam: "Home", idAwayTeam: "away", strAwayTeam: "Away",
      intHomeScore: 10, intAwayScore: 8, strStatus: "Q2",
    }] });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(payload, { status: 200, headers: { "Content-Type": "application/json" } }));
    const events = await new TheSportsDbProvider("test", new ResilientHttpClient()).eventsByDate("2026-06-21");
    expect(events.find((item) => item.id === "basketball-live")).toMatchObject({ status: "live", statusLabel: "Q2" });
    fetchMock.mockRestore();
  });

  it("uses the v2 live score endpoint when a premium key is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ livescore: [{
      idEvent: "live-1", dateEvent: "2026-06-21", strEventTime: "12:00:00", strSport: "Soccer", idLeague: "league-1",
      strLeague: "League", idHomeTeam: "home", strHomeTeam: "Home", idAwayTeam: "away", strAwayTeam: "Away",
      intHomeScore: "1", intAwayScore: "0", strProgress: "63:12 - 2nd",
    }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const events = await new TheSportsDbProvider("premium-key", new ResilientHttpClient()).liveEvents();
    expect(events[0]).toMatchObject({ id: "live-1", status: "live", statusLabel: "63:12 - 2nd", homeScore: 1 });
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers).toMatchObject({ "X-API-KEY": "premium-key" });
    fetchMock.mockRestore();
  });
});

describe("SportsDataIO provider", () => {
  it("uses the subscription header and normalizes games", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      GameId: 42,
      DateTime: "2026-06-21T18:30:00",
      Status: "Final",
      HomeTeamId: 10,
      HomeTeamKey: "BRA",
      AwayTeamId: 20,
      AwayTeamKey: "ARG",
      HomeTeamScore: 2,
      AwayTeamScore: 1,
      CompetitionId: 5,
      CompetitionName: "World Cup",
      VenueName: "Arena",
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    const provider = new SportSrcProvider("https://api.sportsdata.io/v3/soccer/scores/json", "secret");
    const events = await provider.eventsByDate("2026-06-21");
    expect(events[0]).toMatchObject({ id: "sportsdata-42", status: "finished", homeScore: 2, awayScore: 1, sport: "Soccer" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("GamesByDate/2026-JUN-21");
    expect(options?.headers).toMatchObject({ "Ocp-Apim-Subscription-Key": "secret" });
    fetchMock.mockRestore();
  });

  it("formats dates using the API contract", () => {
    expect(formatSportsDataDate("2026-01-09")).toBe("2026-JAN-09");
  });

  it("does not request IDs owned by TheSportsDB", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(new SportSrcProvider("https://api.sportsdata.io/v3/soccer/scores/json", "secret").eventById("12345")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
