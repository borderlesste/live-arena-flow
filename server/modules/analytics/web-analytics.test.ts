import { describe, expect, it, vi } from "vitest";
import {
  cloudflareBackfillStart,
  fetchCloudflareDailyAnalytics,
  getCloudflareWebAnalyticsConfig,
  periodRange,
  summarizeWebAnalytics,
} from "./web-analytics.js";

const config = {
  accountId: "account-id",
  apiToken: "server-secret-token",
  siteTag: "public-site-token",
  timeoutMs: 5_000,
};

describe("Cloudflare Web Analytics", () => {
  it("requires a dedicated analytics token and public site token", () => {
    expect(getCloudflareWebAnalyticsConfig({ CLOUDFLARE_ACCOUNT_ID: "id", CLOUDFLARE_STREAM_API_TOKEN: "stream" })).toBeUndefined();
    expect(getCloudflareWebAnalyticsConfig({
      CLOUDFLARE_ACCOUNT_ID: "id",
      CLOUDFLARE_ANALYTICS_API_TOKEN: "analytics",
      NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "site",
    })).toMatchObject({ accountId: "id", apiToken: "analytics", siteTag: "site" });
  });

  it("fetches and normalizes daily visit totals without exposing the token", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      expect(authorization).toBe("Bearer server-secret-token");
      expect(String(init?.body)).not.toContain("server-secret-token");
      return new Response(JSON.stringify({
        data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{
          count: 12,
          avg: { sampleInterval: 1 },
          dimensions: { date: "2026-07-04", requestHost: "www.luisromerofutbol.com" },
          sum: { visits: 8 },
        }] }] } },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    await expect(fetchCloudflareDailyAnalytics(config, "2026-07-04", "2026-07-04", fetchMock as typeof fetch)).resolves.toEqual([{
      day: "2026-07-04",
      hostname: "www.luisromerofutbol.com",
      visits: 8,
      pageViews: 12,
      sampleInterval: 1,
    }]);
  });

  it("builds stable day, week, month and year ranges", () => {
    const now = new Date("2026-07-04T18:00:00Z");
    expect(periodRange("day", now)).toMatchObject({ start: "2026-07-04", end: "2026-07-04" });
    expect(periodRange("week", now)).toMatchObject({ start: "2026-06-28", end: "2026-07-04" });
    expect(periodRange("month", now)).toMatchObject({ start: "2026-06-05", end: "2026-07-04" });
    expect(periodRange("year", now)).toMatchObject({ start: "2025-07-05", end: "2026-07-04" });
    expect(cloudflareBackfillStart("2025-01-01", now)).toBe("2026-01-06");
  });

  it("aggregates hosts and groups annual series by month", () => {
    const range = periodRange("year", new Date("2026-07-04T18:00:00Z"));
    const summary = summarizeWebAnalytics("year", range, [
      { day: "2026-06-01", hostname: "luisromerofutbol.com", visits: 10, page_views: 14, sample_interval: 1, synced_at: "2026-06-02T00:00:00Z" },
      { day: "2026-06-01", hostname: "www.luisromerofutbol.com", visits: 5, page_views: 8, sample_interval: 1, synced_at: "2026-06-02T00:00:00Z" },
      { day: "2026-07-01", hostname: "www.luisromerofutbol.com", visits: 20, page_views: 30, sample_interval: 1, synced_at: "2026-07-02T00:00:00Z" },
    ], [
      { day: "2025-06-01", hostname: "www.luisromerofutbol.com", visits: 25, page_views: 40, sample_interval: 1, synced_at: "2025-06-02T00:00:00Z" },
    ]);
    expect(summary.totals).toEqual({ visits: 35, pageViews: 52, pagesPerVisit: 1.49 });
    expect(summary.changePercent).toBe(40);
    expect(summary.series).toEqual([
      { date: "2026-06", visits: 15, pageViews: 22 },
      { date: "2026-07", visits: 20, pageViews: 30 },
    ]);
  });
});
