import type { NormalizedSportsEvent, SportsProvider } from "./sports-provider.js";
import type { SportsCatalog } from "./sports-catalog.js";

export class CatalogBackedSportsProvider implements SportsProvider {
  readonly name: string;

  constructor(
    private readonly upstream: SportsProvider,
    private readonly catalog?: SportsCatalog,
  ) {
    this.name = upstream.name;
  }

  async eventsByDate(date: string): Promise<NormalizedSportsEvent[]> {
    if (!this.catalog) return this.upstream.eventsByDate(date);
    let persistedEvents: NormalizedSportsEvent[] | undefined;
    try {
      persistedEvents = await this.catalog.eventsByDate(date);
    } catch {
      persistedEvents = undefined;
    }

    let upstreamEvents: NormalizedSportsEvent[] | undefined;
    let upstreamError: unknown;
    try {
      upstreamEvents = await this.upstream.eventsByDate(date);
      if (upstreamEvents.length > 0) {
        try {
          await this.catalog.syncProviderEvents(this.upstream.name, upstreamEvents);
          const refreshedEvents = await this.catalog.eventsByDate(date);
          if (refreshedEvents.length > 0) return refreshedEvents;
        } catch {
          console.warn("[sports-catalog] provider sync failed; using persisted catalog", { code: "SPORTS_CATALOG_SYNC_FALLBACK" });
        }
      }
    } catch (error) {
      upstreamError = error;
    }

    if (upstreamEvents) {
      return [...new Map([...(persistedEvents ?? []), ...upstreamEvents].map((event) => [event.id, event])).values()]
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id));
    }
    if (persistedEvents !== undefined) return persistedEvents;
    throw upstreamError ?? new Error("SPORTS_CATALOG_MISSING_DATA");
  }

  async liveEvents(): Promise<NormalizedSportsEvent[]> {
    if (!this.catalog) return this.upstream.liveEvents();
    let upstreamEvents: NormalizedSportsEvent[] = [];
    try {
      upstreamEvents = await this.upstream.liveEvents();
      await this.catalog.syncProviderEvents(this.upstream.name, upstreamEvents);
    } catch {
      console.warn("[sports-catalog] live provider sync failed; returning persisted local live events", { code: "SPORTS_CATALOG_LIVE_FALLBACK" });
    }
    try {
      return await this.catalog.liveEvents(this.upstream.name, upstreamEvents.map((event) => event.id));
    } catch (catalogError) {
      if (upstreamEvents.length > 0) return upstreamEvents;
      throw catalogError;
    }
  }

  async eventById(id: string): Promise<NormalizedSportsEvent | undefined> {
    if (!this.catalog) return this.upstream.eventById(id);
    if (id.startsWith("local-")) return this.catalog.eventById(id);
    const persistedEvent = await this.catalog.eventById(id);
    if (persistedEvent) {
      return persistedEvent;
    }

    try {
      const upstreamEvent = await this.upstream.eventById(id);
      if (upstreamEvent) {
        try {
          await this.catalog.syncProviderEvents(this.upstream.name, [upstreamEvent]);
        } catch {
          console.warn("[sports-catalog] event provider lookup failed; using persisted catalog", { code: "SPORTS_CATALOG_EVENT_FALLBACK" });
        }
        return await this.catalog.eventById(id) ?? upstreamEvent;
      }
    } catch {
      console.warn("[sports-catalog] event provider lookup failed; using persisted catalog", { code: "SPORTS_CATALOG_EVENT_FALLBACK" });
    }
    return persistedEvent;
  }
}
