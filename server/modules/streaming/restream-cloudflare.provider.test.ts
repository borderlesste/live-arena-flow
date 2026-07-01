import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareStreamProvider } from "./cloudflare.provider.js";
import { getLiveStreamProvider } from "./factory.js";
import { RestreamCloudflareProvider } from "./restream-cloudflare.provider.js";
import { RestreamProvider } from "./restream.provider.js";

const ENV_KEYS = [
  "STREAM_PROVIDER",
  "RESTREAM_ACCESS_TOKEN",
  "RESTREAM_INGEST_URL",
  "RESTREAM_STREAM_KEY",
  "RESTREAM_API_TIMEOUT_MS",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_STREAM_API_TOKEN",
  "CLOUDFLARE_STREAM_CUSTOMER_CODE",
  "CLOUDFLARE_STREAM_API_TIMEOUT_MS",
  "CLOUDFLARE_STREAM_RECORDING_MODE",
] as const;

describe("RestreamCloudflareProvider", () => {
  const previousEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) previousEnv.set(key, process.env[key]);
    process.env.RESTREAM_INGEST_URL = "rtmps://live.restream.io:1937/live";
    process.env.RESTREAM_STREAM_KEY = "restream-test-key";
    process.env.RESTREAM_API_TIMEOUT_MS = "5000";
    process.env.CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
    process.env.CLOUDFLARE_STREAM_API_TOKEN = "cloudflare-test-token";
    process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = "customer123";
    process.env.CLOUDFLARE_STREAM_API_TIMEOUT_MS = "5000";
    process.env.CLOUDFLARE_STREAM_RECORDING_MODE = "automatic";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      const value = previousEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previousEnv.clear();
  });

  it("publishes OBS to Restream and relays into a Cloudflare HLS input", async () => {
    vi.spyOn(RestreamProvider.prototype, "getCredentials").mockResolvedValue({
      ingestProtocol: "rtmps",
      ingestUrl: "rtmps://live.restream.io:1937/live",
      streamKey: "restream-test-key",
    });
    vi.spyOn(CloudflareStreamProvider.prototype, "createLiveInput").mockResolvedValue({
      provider: "cloudflare_stream",
      providerInputId: "cfinput123",
      ingestProtocol: "rtmps",
      ingestUrl: "rtmps://live.cloudflare.com:443/live/",
      streamKey: "cloudflare-destination-key",
      playbackFormat: "hls",
      playbackUrl: "https://customer-customer123.cloudflarestream.com/cfinput123/manifest/video.m3u8",
      status: "waiting_signal",
    });

    const result = await new RestreamCloudflareProvider().createLiveInput({ name: "Partido principal" });

    expect(result).toMatchObject({
      provider: "restream_cloudflare",
      providerInputId: "cfinput123",
      ingestUrl: "rtmps://live.restream.io:1937/live",
      streamKey: "restream-test-key",
      playbackUrl: "https://customer-customer123.cloudflarestream.com/cfinput123/manifest/video.m3u8",
      relayDestination: {
        ingestUrl: "rtmps://live.cloudflare.com:443/live/",
        streamKey: "cloudflare-destination-key",
      },
    });
  });

  it.each(["restream_cloudflare", "restream+cloudflare"])("is selected by the factory for %s", (name) => {
    process.env.STREAM_PROVIDER = name;
    expect(getLiveStreamProvider()).toBeInstanceOf(RestreamCloudflareProvider);
  });
});
