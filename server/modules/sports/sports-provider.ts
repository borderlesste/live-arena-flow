import { z } from "zod";

export const normalizedSportsEventSchema = z.object({
  id: z.string().min(1),
  startsAt: z.string().datetime(),
  sport: z.enum(["Football", "football", "Soccer", "soccer"]),
  competition: z.object({ id: z.string().min(1), name: z.string().min(1), region: z.string().optional(), badgeUrl: z.string().url().optional() }),
  homeTeam: z.object({ id: z.string().min(1), name: z.string().min(1), badgeUrl: z.string().url().optional() }),
  awayTeam: z.object({ id: z.string().min(1), name: z.string().min(1), badgeUrl: z.string().url().optional() }),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  status: z.enum(["scheduled", "live", "halftime", "paused", "finished", "postponed", "cancelled"]),
  statusLabel: z.string().optional(),
  venue: z.string().optional(),
  city: z.string().optional(),
  highlightUrl: z.string().url().optional(),
});

export type NormalizedSportsEvent = z.infer<typeof normalizedSportsEventSchema>;

export interface SportsProvider {
  readonly name: string;
  eventsByDate(date: string): Promise<NormalizedSportsEvent[]>;
  liveEvents(): Promise<NormalizedSportsEvent[]>;
  eventById(id: string): Promise<NormalizedSportsEvent | undefined>;
}

interface RequestOptions { headers?: Record<string, string> }

export class ResilientHttpClient {
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(private readonly timeoutMs = 6_000, private readonly maxAttempts = 3) {}

  async json(url: URL, options: RequestOptions = {}): Promise<unknown> {
    if (Date.now() < this.circuitOpenUntil) throw new Error("SPORTS_PROVIDER_CIRCUIT_OPEN");
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json", ...options.headers },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable) throw new Error(`SPORTS_PROVIDER_${response.status}`);
          throw new RetryableProviderError(response.status);
        }
        const value = await response.json();
        this.consecutiveFailures = 0;
        return value;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof RetryableProviderError || error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError");
        if (!retryable || attempt === this.maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100)));
      }
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 3) this.circuitOpenUntil = Date.now() + 30_000;
    throw lastError instanceof Error ? lastError : new Error("SPORTS_PROVIDER_FAILURE");
  }
}

class RetryableProviderError extends Error {
  constructor(status: number) { super(`SPORTS_PROVIDER_${status}`); }
}

export class CachedSportsProvider implements SportsProvider {
  readonly name: string;
  private readonly cache = new Map<string, { expiresAt: number; value: NormalizedSportsEvent[] }>();

  constructor(private readonly provider: SportsProvider, private readonly ttlMs = 5 * 60_000) {
    this.name = provider.name;
  }

  async eventsByDate(date: string) {
    const key = `date:${date}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.provider.eventsByDate(date);
    this.cache.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    return value;
  }

  async liveEvents() {
    const key = "live:now";
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.provider.liveEvents();
    this.cache.set(key, { expiresAt: Date.now() + Math.min(this.ttlMs, 60_000), value });
    return value;
  }

  eventById(id: string) {
    return this.provider.eventById(id);
  }
}
