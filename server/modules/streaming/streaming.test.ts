// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomRtmpProvider } from "./providers.js";
import { CloudflareStreamProvider } from "./cloudflare.provider.js";
import { getLiveStreamProvider } from "./factory.js";

describe("CustomRtmpProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("createLiveInput returns a valid CreatedLiveInput with rtmp protocol", async () => {
    process.env.STREAM_INGEST_URL = "rtmp://ingest.example.com/live";
    const provider = new CustomRtmpProvider();
    const result = await provider.createLiveInput({ name: "Test Stream" });

    expect(result.provider).toBe("custom");
    expect(result.ingestProtocol).toBe("rtmp");
    expect(result.ingestUrl).toBe("rtmp://ingest.example.com/live");
    expect(result.streamKey).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(result.playbackUrl).toBeNull();
    expect(result.status).toBe("ready");
    expect(result.playbackFormat).toBe("hls");
    expect(typeof result.providerInputId).toBe("string");
  });

  it("createLiveInput detects rtmps protocol from URL", async () => {
    process.env.STREAM_INGEST_URL = "rtmps://secure.example.com:443/live";
    const provider = new CustomRtmpProvider();
    const result = await provider.createLiveInput({ name: "Secure Stream" });
    expect(result.ingestProtocol).toBe("rtmps");
  });

  it("createLiveInput detects srt protocol from URL", async () => {
    process.env.STREAM_INGEST_URL = "srt://srt.example.com:9000";
    const provider = new CustomRtmpProvider();
    const result = await provider.createLiveInput({ name: "SRT Stream" });
    expect(result.ingestProtocol).toBe("srt");
  });

  it("createLiveInput uses fallback localhost URLs when env vars are not set", async () => {
    delete process.env.STREAM_INGEST_URL;
    delete process.env.STREAM_PLAYBACK_BASE_URL;
    const provider = new CustomRtmpProvider();
    const result = await provider.createLiveInput({ name: "Local Test" });
    expect(result.ingestUrl).toContain("127.0.0.1");
    expect(result.playbackUrl).toBeNull();
  });

  it("never derives playbackUrl from streamKey and STREAM_PLAYBACK_BASE_URL", async () => {
    process.env.STREAM_INGEST_URL = "rtmp://ingest.example.com/live";
    process.env.STREAM_PLAYBACK_BASE_URL = "https://cdn.example.com/live";
    const provider = new CustomRtmpProvider();
    const result = await provider.createLiveInput({ name: "Key URL Test" });
    expect(result.playbackUrl).toBeNull();
  });

  it("each createLiveInput call generates unique providerInputId and streamKey", async () => {
    process.env.STREAM_INGEST_URL = "rtmp://ingest.example.com/live";
    process.env.STREAM_PLAYBACK_BASE_URL = "https://cdn.example.com/live";
    const provider = new CustomRtmpProvider();
    const a = await provider.createLiveInput({ name: "A" });
    const b = await provider.createLiveInput({ name: "B" });
    expect(a.providerInputId).not.toBe(b.providerInputId);
    expect(a.streamKey).not.toBe(b.streamKey);
  });

  it("rotateCredentials returns a new streamKey and the same ingestUrl", async () => {
    process.env.STREAM_INGEST_URL = "rtmp://ingest.example.com/live";
    const provider = new CustomRtmpProvider();
    const original = await provider.createLiveInput({ name: "Rotate Test" });
    const rotated = await provider.rotateCredentials!(original.providerInputId);
    expect(rotated.streamKey).not.toBe(original.streamKey);
    expect(rotated.ingestUrl).toBe("rtmp://ingest.example.com/live");
  });

  it("getLiveInputStatus returns ready when STREAM_API_URL is not configured", async () => {
    delete process.env.STREAM_API_URL;
    const provider = new CustomRtmpProvider();
    const status = await provider.getLiveInputStatus("any-id");
    expect(status).toBe("ready");
  });

  it("getLiveInputStatus returns ready when STREAM_API_URL endpoint fails", async () => {
    process.env.STREAM_API_URL = "http://nonexistent.local:9999";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new CustomRtmpProvider();
    const status = await provider.getLiveInputStatus("some-id");
    expect(status).toBe("ready");
    fetchMock.mockRestore();
    delete process.env.STREAM_API_URL;
  });

  it("getLiveInputStatus returns live when MediaMTX reports an active path", async () => {
    process.env.STREAM_API_URL = "http://media.example.com:9997";
    const payload = { items: [{ sourceReady: true, name: "live" }] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const provider = new CustomRtmpProvider();
    const status = await provider.getLiveInputStatus("some-id");
    expect(status).toBe("live");
    fetchMock.mockRestore();
    delete process.env.STREAM_API_URL;
  });

  it("deleteLiveInput and disableLiveInput do not throw", async () => {
    const provider = new CustomRtmpProvider();
    await expect(provider.deleteLiveInput("any-id")).resolves.toBeUndefined();
    await expect(provider.disableLiveInput("any-id")).resolves.toBeUndefined();
    await expect(provider.enableLiveInput("any-id")).resolves.toBeUndefined();
  });
});

describe("getLiveStreamProvider factory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns CustomRtmpProvider when STREAM_PROVIDER=custom", () => {
    process.env.STREAM_PROVIDER = "custom";
    expect(getLiveStreamProvider()).toBeInstanceOf(CustomRtmpProvider);
  });

  it("returns CustomRtmpProvider when STREAM_PROVIDER is empty", () => {
    process.env.STREAM_PROVIDER = "";
    expect(getLiveStreamProvider()).toBeInstanceOf(CustomRtmpProvider);
  });

  it("returns CustomRtmpProvider when STREAM_PROVIDER is unset", () => {
    delete process.env.STREAM_PROVIDER;
    expect(getLiveStreamProvider()).toBeInstanceOf(CustomRtmpProvider);
  });

  it("falls back to CustomRtmpProvider and warns for unknown provider", () => {
    process.env.STREAM_PROVIDER = "unknown_provider";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = getLiveStreamProvider();
    expect(provider).toBeInstanceOf(CustomRtmpProvider);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown_provider"));
    warnSpy.mockRestore();
  });

  it("allows OBS to bypass Restream and publish directly to Cloudflare", () => {
    process.env.STREAM_PROVIDER = "restream_cloudflare";
    expect(getLiveStreamProvider("direct_cloudflare")).toBeInstanceOf(CloudflareStreamProvider);
  });
});
