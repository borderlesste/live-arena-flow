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
    let upstreamEvents: NormalizedSportsEvent[] | undefined;
    let upstreamError: unknown;
    try {
      upstreamEvents = await this.upstream.eventsByDate(date);
      await this.catalog.syncProviderEvents(this.upstream.name, upstreamEvents);
    } catch (error) {
      upstreamError = error;
      console.warn("[sports-catalog] provider sync failed; using persisted catalog", { code: "SPORTS_CATALOG_SYNC_FALLBACK" });
    }
    try {
      return await this.catalog.eventsByDate(date);
    } catch (catalogError) {
      if (upstreamEvents) return upstreamEvents;
      throw upstreamError ?? catalogError;
    }
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
    try {
      const upstreamEvent = await this.upstream.eventById(id);
      if (upstreamEvent) {
        await this.catalog.syncProviderEvents(this.upstream.name, [upstreamEvent]);
        return await this.catalog.eventById(id) ?? upstreamEvent;
      }
    } catch {
      console.warn("[sports-catalog] event provider lookup failed; using persisted catalog", { code: "SPORTS_CATALOG_EVENT_FALLBACK" });
    }
    return this.catalog.eventById(id);
  }
}
