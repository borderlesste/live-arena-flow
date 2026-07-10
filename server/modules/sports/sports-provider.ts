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
  status: z.enum(["scheduled", "live", "halftime", "paused", "finished", "postponed", "cancelled", "unknown"]),
  statusLabel: z.string().optional(),
  venue: z.string().optional(),
  city: z.string().optional(),
  phase: z.string().optional(),
  group: z.string().optional(),
  highlightUrl: z.string().url().optional(),
});

export type NormalizedSportsEvent = z.infer<typeof normalizedSportsEventSchema>;

export interface SportsProvider {
  readonly name: string;
  eventsByDate(date: string): Promise<NormalizedSportsEvent[]>;
  liveEvents(): Promise<NormalizedSportsEvent[]>;
  eventById(id: string): Promise<NormalizedSportsEvent | undefined>;
}

const SPORTS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function enumerateSportsDates(start: string, end: string, maxDays = 62): string[] {
  if (!SPORTS_DATE_PATTERN.test(start) || !SPORTS_DATE_PATTERN.test(end)) {
    throw new Error("INVALID_SPORTS_DATE_RANGE");
  }
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (
    Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) ||
    startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end ||
    startDate > endDate
  ) {
    throw new Error("INVALID_SPORTS_DATE_RANGE");
  }
  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (dayCount > maxDays) throw new Error("SPORTS_DATE_RANGE_TOO_LARGE");
  return Array.from({ length: dayCount }, (_, index) =>
    new Date(startDate.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}

export async function eventsByDateRange(
  provider: SportsProvider,
  start: string,
  end: string,
  concurrency = 4,
): Promise<NormalizedSportsEvent[]> {
  const dates = enumerateSportsDates(start, end);
  const batches: NormalizedSportsEvent[][] = [];
  const workerCount = Math.max(1, Math.min(Math.trunc(concurrency), dates.length));
  let nextIndex = 0;

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < dates.length) {
      const index = nextIndex;
      nextIndex += 1;
      batches[index] = await provider.eventsByDate(dates[index]);
    }
  }));

  return [...new Map(batches.flat().map((event) => [event.id, event])).values()]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id));
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
