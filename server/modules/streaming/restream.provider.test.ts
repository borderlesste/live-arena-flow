// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLiveStreamProvider } from "./factory.js";
import { RestreamProvider } from "./restream.provider.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.RESTREAM_ACCESS_TOKEN;
  delete process.env.RESTREAM_INGEST_URL;
  delete process.env.RESTREAM_STREAM_KEY;
  process.env.RESTREAM_API_TIMEOUT_MS = "5000";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("RestreamProvider", () => {
  it("uses static server-side credentials when configured", async () => {
    process.env.RESTREAM_INGEST_URL = "rtmp://live.restream.io/live";
    process.env.RESTREAM_STREAM_KEY = "restream-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const input = await new RestreamProvider().createLiveInput({ name: "Principal" });

    expect(input).toMatchObject({
      provider: "restream",
      providerInputId: "restream-static",
      ingestProtocol: "rtmp",
      ingestUrl: "rtmp://live.restream.io/live",
      streamKey: "restream-test-key",
      playbackUrl: null,
      status: "ready",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads selected ingest and stream key from the official API", async () => {
    process.env.RESTREAM_ACCESS_TOKEN = "restream-access-token";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/user/ingest")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer restream-access-token");
        return Response.json({ ingestId: 8 });
      }
      if (url.endsWith("/user/streamKey")) return Response.json({ streamKey: "api-stream-key", srtUrl: null });
      if (url.endsWith("/server/all")) {
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        return Response.json([{ id: 8, rtmpUrl: "rtmp://miami.restream.io/live" }]);
      }
      return new Response("not found", { status: 404 });
    });

    const input = await new RestreamProvider().createLiveInput({ name: "Principal" });

    expect(input).toMatchObject({
      providerInputId: "restream-ingest-8",
      ingestUrl: "rtmp://miami.restream.io/live",
      streamKey: "api-stream-key",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("fails closed when credentials are missing", async () => {
    await expect(new RestreamProvider().createLiveInput({ name: "Principal" })).rejects.toThrow();
  });

  it("does not expose an expired API token as a provider success", async () => {
    process.env.RESTREAM_ACCESS_TOKEN = "expired-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));

    await expect(new RestreamProvider().createLiveInput({ name: "Principal" })).rejects.toThrow("RESTREAM_HTTP_401");
  });
});

describe("Restream factory", () => {
  it.each(["restream", "restream_io"])("selects RestreamProvider for %s", (providerName) => {
    process.env.STREAM_PROVIDER = providerName;
    expect(getLiveStreamProvider()).toBeInstanceOf(RestreamProvider);
  });
});
