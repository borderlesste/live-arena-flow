import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const DAY_MS = 86_400_000;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const numericValueSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid non-negative number" });
    return z.NEVER;
  }
  return parsed;
});

const graphQlResponseSchema = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.array(z.object({
        rumPageloadEventsAdaptiveGroups: z.array(z.object({
          count: numericValueSchema,
          avg: z.object({ sampleInterval: numericValueSchema }),
          dimensions: z.object({
            date: dateSchema,
            requestHost: z.string().min(1),
          }),
          sum: z.object({ visits: numericValueSchema }),
        })),
      })),
    }),
  }).optional(),
  errors: z.array(z.object({
    message: z.string(),
    extensions: z.object({ code: z.string().optional() }).passthrough().optional(),
  })).optional(),
});

const dailyRowSchema = z.object({
  day: dateSchema,
  hostname: z.string().min(1),
  visits: z.number().nonnegative(),
  pageViews: z.number().nonnegative(),
  sampleInterval: z.number().positive(),
});

export type WebAnalyticsPeriod = "day" | "week" | "month" | "year";

export interface CloudflareWebAnalyticsConfig {
  accountId: string;
  apiToken: string;
  siteTag: string;
  timeoutMs: number;
}

export interface WebAnalyticsDailyRow {
  day: string;
  hostname: string;
  visits: number;
  pageViews: number;
  sampleInterval: number;
}

export interface StoredWebAnalyticsRow {
  day: string;
  hostname: string;
  visits: number | string;
  page_views: number | string;
  sample_interval: number | string;
  synced_at: string;
}

export interface WebAnalyticsSeriesPoint {
  date: string;
  visits: number;
  pageViews: number;
}

export interface WebAnalyticsSummary {
  period: WebAnalyticsPeriod;
  start: string;
  end: string;
  totals: { visits: number; pageViews: number; pagesPerVisit: number };
  previous: { visits: number; pageViews: number };
  changePercent: number | null;
  series: WebAnalyticsSeriesPoint[];
  lastSyncedAt: string | null;
}

export function getCloudflareWebAnalyticsConfig(env: NodeJS.ProcessEnv = process.env): CloudflareWebAnalyticsConfig | undefined {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim();
  const siteTag = (env.CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN || env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN)?.trim();
  if (!accountId || !apiToken || !siteTag) return undefined;
  const configuredTimeout = Number(env.CLOUDFLARE_ANALYTICS_API_TIMEOUT_MS || 15_000);
  return {
    accountId,
    apiToken,
    siteTag,
    timeoutMs: Number.isFinite(configuredTimeout) ? Math.max(1_000, configuredTimeout) : 15_000,
  };
}

export function periodRange(period: WebAnalyticsPeriod, now = new Date()): { start: string; end: string; previousStart: string; previousEnd: string } {
  const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = new Date(endDate.getTime() - (days - 1) * DAY_MS);
  const previousEndDate = new Date(startDate.getTime() - DAY_MS);
  const previousStartDate = new Date(previousEndDate.getTime() - (days - 1) * DAY_MS);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    previousStart: previousStartDate.toISOString().slice(0, 10),
    previousEnd: previousEndDate.toISOString().slice(0, 10),
  };
}

export async function fetchCloudflareDailyAnalytics(
  config: CloudflareWebAnalyticsConfig,
  start: string,
  end: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebAnalyticsDailyRow[]> {
  dateSchema.parse(start);
  dateSchema.parse(end);
  const query = `
    query WebAnalyticsDaily($accountTag: string!, $siteTag: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumPageloadEventsAdaptiveGroups(
            limit: 1000
            filter: { date_geq: $start, date_leq: $end, siteTag: $siteTag, bot: 0 }
            orderBy: [date_ASC]
          ) {
            count
            avg { sampleInterval }
            dimensions { date requestHost }
            sum { visits }
          }
        }
      }
    }
  `;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(CLOUDFLARE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { accountTag: config.accountId, siteTag: config.siteTag, start, end },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`CLOUDFLARE_ANALYTICS_HTTP_${response.status}`);
  const parsed = graphQlResponseSchema.parse(await response.json());
  if (parsed.errors?.length) {
    const code = parsed.errors[0]?.extensions?.code?.toUpperCase() || "GRAPHQL";
    throw new Error(`CLOUDFLARE_ANALYTICS_${code}`);
  }
  const account = parsed.data?.viewer.accounts[0];
  if (!account) throw new Error("CLOUDFLARE_ANALYTICS_ACCOUNT_UNAVAILABLE");

  const aggregate = new Map<string, WebAnalyticsDailyRow>();
  for (const row of account.rumPageloadEventsAdaptiveGroups) {
    const key = `${row.dimensions.date}\u0000${row.dimensions.requestHost}`;
    const current = aggregate.get(key) ?? {
      day: row.dimensions.date,
      hostname: row.dimensions.requestHost,
      visits: 0,
      pageViews: 0,
      sampleInterval: 1,
    };
    current.visits += row.sum.visits;
    current.pageViews += row.count;
    current.sampleInterval = Math.max(current.sampleInterval, row.avg.sampleInterval);
    aggregate.set(key, dailyRowSchema.parse(current));
  }
  return [...aggregate.values()].sort((a, b) => a.day.localeCompare(b.day) || a.hostname.localeCompare(b.hostname));
}

export async function syncCloudflareWebAnalytics(
  client: SupabaseClient,
  config: CloudflareWebAnalyticsConfig,
  start: string,
  end: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ synced: number }> {
  const rows = await fetchCloudflareDailyAnalytics(config, start, end, fetchImpl);
  if (rows.length === 0) return { synced: 0 };
  const syncedAt = new Date().toISOString();
  const result = await client.from("web_analytics_daily").upsert(rows.map((row) => ({
    day: row.day,
    site_tag: config.siteTag,
    hostname: row.hostname,
    visits: Math.round(row.visits),
    page_views: Math.round(row.pageViews),
    sample_interval: row.sampleInterval,
    source: "cloudflare",
    synced_at: syncedAt,
  })), { onConflict: "day,site_tag,hostname" });
  if (result.error) throw result.error;
  return { synced: rows.length };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function summarizeWebAnalytics(
  period: WebAnalyticsPeriod,
  range: ReturnType<typeof periodRange>,
  currentRows: StoredWebAnalyticsRow[],
  previousRows: StoredWebAnalyticsRow[],
): WebAnalyticsSummary {
  const toNumber = (value: number | string) => Number(value) || 0;
  const totals = currentRows.reduce((result, row) => ({
    visits: result.visits + toNumber(row.visits),
    pageViews: result.pageViews + toNumber(row.page_views),
  }), { visits: 0, pageViews: 0 });
  const previous = previousRows.reduce((result, row) => ({
    visits: result.visits + toNumber(row.visits),
    pageViews: result.pageViews + toNumber(row.page_views),
  }), { visits: 0, pageViews: 0 });
  const buckets = new Map<string, WebAnalyticsSeriesPoint>();
  for (const row of currentRows) {
    const key = period === "year" ? monthKey(row.day) : row.day;
    const point = buckets.get(key) ?? { date: key, visits: 0, pageViews: 0 };
    point.visits += toNumber(row.visits);
    point.pageViews += toNumber(row.page_views);
    buckets.set(key, point);
  }
  const lastSyncedAt = currentRows.map((row) => row.synced_at).filter(Boolean).sort().at(-1) ?? null;
  return {
    period,
    start: range.start,
    end: range.end,
    totals: {
      ...totals,
      pagesPerVisit: totals.visits > 0 ? Number((totals.pageViews / totals.visits).toFixed(2)) : 0,
    },
    previous,
    changePercent: previous.visits > 0 ? Number((((totals.visits - previous.visits) / previous.visits) * 100).toFixed(1)) : null,
    series: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
    lastSyncedAt,
  };
}

export function cloudflareBackfillStart(start: string, now = new Date()): string {
  dateSchema.parse(start);
  const earliest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 179 * DAY_MS).toISOString().slice(0, 10);
  return start < earliest ? earliest : start;
}
