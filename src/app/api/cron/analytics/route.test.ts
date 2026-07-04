import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("analytics cron route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without the Vercel cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const response = await GET(new Request("https://example.com/api/cron/analytics"));
    expect(response.status).toBe(401);
  });

  it("forwards an authorized daily sync without exposing its response", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("API_INTERNAL_URL", "https://backend.example.com");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ synced: 2 }), { status: 200 }));
    const response = await GET(new Request("https://example.com/api/cron/analytics", {
      headers: { Authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://backend.example.com/api/internal/analytics/sync"), expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer cron-secret" }),
    }));
  });
});
