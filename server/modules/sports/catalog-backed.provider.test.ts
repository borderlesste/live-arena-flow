import { describe, expect, it, vi } from "vitest";
import { CatalogBackedSportsProvider } from "./catalog-backed.provider.js";
import type { NormalizedSportsEvent, SportsProvider } from "./sports-provider.js";
import type { SportsCatalog } from "./sports-catalog.js";

const event: NormalizedSportsEvent = {
  id: "sportsrc-1",
  startsAt: "2026-07-03T18:00:00.000Z",
  sport: "Football",
  competition: { id: "competition-1", name: "Liga" },
  homeTeam: { id: "home", name: "Local" },
  awayTeam: { id: "away", name: "Visitante" },
  homeScore: 0,
  awayScore: 0,
  status: "scheduled",
};

function setup() {
  const upstream: SportsProvider = {
    name: "sportsrc",
    eventsByDate: vi.fn(async () => [event]),
    liveEvents: vi.fn(async () => []),
    eventById: vi.fn(async () => event),
  };
  const catalog: SportsCatalog = {
    syncProviderEvents: vi.fn(async () => undefined),
    eventsByDate: vi.fn(async () => [event]),
    liveEvents: vi.fn(async () => []),
    eventById: vi.fn(async () => event),
    findMatchUuid: vi.fn(async () => "00000000-0000-4000-8000-000000000001"),
    createLocalMatch: vi.fn(async () => event),
  };
  return { upstream, catalog, provider: new CatalogBackedSportsProvider(upstream, catalog) };
}

describe("CatalogBackedSportsProvider", () => {
  it("refreshes the provider and returns the combined persisted catalog", async () => {
    const { provider, upstream, catalog } = setup();
    await expect(provider.eventsByDate("2026-07-03")).resolves.toEqual([event]);
    expect(catalog.eventsByDate).toHaveBeenCalledTimes(2);
    expect(upstream.eventsByDate).toHaveBeenCalledWith("2026-07-03");
    expect(catalog.syncProviderEvents).toHaveBeenCalledWith("sportsrc", [event]);
  });

  it("reads local events without calling the external provider", async () => {
    const { provider, upstream, catalog } = setup();
    await provider.eventById("local-00000000-0000-4000-8000-000000000001");
    expect(upstream.eventById).not.toHaveBeenCalled();
    expect(catalog.eventById).toHaveBeenCalled();
  });

  it("falls back to upstream events when catalog persistence fails", async () => {
    const { provider, catalog } = setup();
    vi.mocked(catalog.syncProviderEvents).mockRejectedValueOnce(new Error("db unavailable"));
    vi.mocked(catalog.eventsByDate).mockRejectedValueOnce(new Error("db unavailable"));
    await expect(provider.eventsByDate("2026-07-03")).resolves.toEqual([event]);
  });

  it("returns persisted events when the upstream provider fails", async () => {
    const { provider, upstream } = setup();
    vi.mocked(upstream.eventsByDate).mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(provider.eventsByDate("2026-07-03")).resolves.toEqual([event]);
  });
});
