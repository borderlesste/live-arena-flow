// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CachedSportsProvider,
  ResilientHttpClient,
  type NormalizedSportsEvent,
  type SportsProvider,
} from "./sports-provider.js";
import { normalizeSportSrcStatus, SportSrcProvider } from "./sportsrc.provider.js";

const event: NormalizedSportsEvent = {
  id: "event-1",
  startsAt: "2026-06-21T12:00:00.000Z",
  sport: "Football",
  competition: { id: "league-1", name: "League" },
  homeTeam: { id: "home", name: "Home" },
  awayTeam: { id: "away", name: "Away" },
  homeScore: 0,
  awayScore: 0,
  status: "scheduled",
};

const sportSrcMatch = {
  id: "match-42",
  timestamp: 1_782_061_200,
  title: "Brasil vs Argentina",
  status: "finished",
  status_detail: "Ended",
  round: "Final",
  has_highlights: true,
  teams: {
    home: { name: "Brasil", code: "BRA", badge: "https://cdn.example/bra.png", color: "#00aa00" },
    away: { name: "Argentina", code: "ARG", badge: "https://cdn.example/arg.png", color: "#00aaff" },
  },
  score: {
    current: { home: 2, away: 1 },
    display: "2 - 1",
    normal_time: null,
    period_1: null,
    period_2: null,
  },
};

const sportSrcLeague = {
  name: "World Cup",
  country: "International",
  flag: "https://cdn.example/flag.png",
  logo: "https://cdn.example/league.png",
};

function listPayload(match = sportSrcMatch) {
  return { success: true, data: [{ league: sportSrcLeague, matches: [match] }] };
}

describe("CachedSportsProvider", () => {
  it("does not spend provider quota twice within the TTL", async () => {
    const eventsByDate = vi.fn(async () => [event]);
    const provider: SportsProvider = { name: "test", eventsByDate, liveEvents: async () => [event], eventById: async () => event };
    const cached = new CachedSportsProvider(provider, 60_000);
    await cached.eventsByDate("2026-06-21");
    await cached.eventsByDate("2026-06-21");
    expect(eventsByDate).toHaveBeenCalledTimes(1);
  });

  it("uses a shorter cache for live events", async () => {
    const liveEvents = vi.fn(async () => [event]);
    const provider: SportsProvider = { name: "test", eventsByDate: async () => [event], liveEvents, eventById: async () => event };
    const cached = new CachedSportsProvider(provider, 60_000);
    await cached.liveEvents();
    await cached.liveEvents();
    expect(liveEvents).toHaveBeenCalledTimes(1);
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

describe("SportSRC V2 provider", () => {
  it("uses the official query contract and normalizes grouped matches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(listPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const events = await new SportSrcProvider("license-key").eventsByDate("2026-06-21");
    expect(events[0]).toMatchObject({
      id: "sportsrc-match-42",
      sport: "Football",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      competition: { name: "World Cup", region: "International" },
      homeTeam: { name: "Brasil" },
      awayTeam: { name: "Argentina" },
    });
    const [request, options] = fetchMock.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://api.sportsrc.org/v2/");
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: "matches", sport: "football", date: "2026-06-21" });
    expect(options?.headers).toEqual(expect.objectContaining({ "X-API-KEY": "license-key" }));
    fetchMock.mockRestore();
  });

  it("requests live matches with one inprogress query", async () => {
    const liveMatch = { ...sportSrcMatch, status: "inprogress", status_detail: "Halftime" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(listPayload(liveMatch)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const events = await new SportSrcProvider("license-key").liveEvents();
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("halftime");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: "matches", sport: "football", status: "inprogress" });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });

  it("uses the detail endpoint for SportSRC IDs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        match_info: { ...sportSrcMatch, league: sportSrcLeague },
        info: { venue: { name: "Arena Nacional" } },
        sources: [],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const detail = await new SportSrcProvider("license-key").eventById("sportsrc-match-42");
    expect(detail).toMatchObject({ id: "sportsrc-match-42", venue: "Arena Nacional" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: "detail", id: "match-42" });
    fetchMock.mockRestore();
  });

  it("skips provider placeholders with invalid timestamps", async () => {
    const invalidMatch = {
      ...sportSrcMatch,
      id: "germany  third place group abcdf-1782548729",
      timestamp: 0,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(listPayload(invalidMatch)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(new SportSrcProvider("license-key").eventsByDate("2026-06-29")).resolves.toEqual([]);
    expect(warning).toHaveBeenCalledWith("[sportsrc] skipped invalid match", expect.objectContaining({
      reason: "SPORTSRC_INVALID_TIMESTAMP",
    }));

    warning.mockRestore();
    fetchMock.mockRestore();
  });

  it("treats missing provider details as not found", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(new SportSrcProvider("license-key").eventById("sportsrc-missing-match")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockRestore();
  });

  it("does not request foreign IDs and rejects invalid dates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const provider = new SportSrcProvider("license-key");
    await expect(provider.eventById("other-42")).resolves.toBeUndefined();
    expect(() => provider.eventsByDate("21-06-2026")).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("maps every documented lifecycle state", () => {
    expect(normalizeSportSrcStatus("inprogress", "1st half")).toBe("live");
    expect(normalizeSportSrcStatus("inprogress", "Halftime")).toBe("halftime");
    expect(normalizeSportSrcStatus("interrupted", "Interrupted")).toBe("paused");
    expect(normalizeSportSrcStatus("postponed", "Postponed")).toBe("postponed");
    expect(normalizeSportSrcStatus("finished", "Ended")).toBe("finished");
    expect(normalizeSportSrcStatus("notstarted", "Upcoming")).toBe("scheduled");
  });
});
