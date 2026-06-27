import { CloudflareStreamProvider } from "./cloudflare.provider.js";
import { CustomRtmpProvider } from "./providers.js";
import type { LiveStreamProvider } from "./types.js";

/**
 * Returns the configured live stream provider.
 *
 * Set STREAM_PROVIDER in the environment to choose:
 *   STREAM_PROVIDER=cloudflare  → CloudflareStreamProvider (Cloudflare Stream Live Inputs)
 *   STREAM_PROVIDER=custom      → CustomRtmpProvider (your own RTMP/RTMPS/SRT server)
 *
 * The default is "custom" for backward compatibility.
 * The API token (CLOUDFLARE_STREAM_API_TOKEN) is only read server-side, never exposed to the frontend.
 */
export function getLiveStreamProvider(): LiveStreamProvider {
  const providerName = (process.env.STREAM_PROVIDER || "custom").toLowerCase().trim();

  switch (providerName) {
    case "cloudflare":
    case "cloudflare_stream":
      return new CloudflareStreamProvider();

    case "custom":
    case "rtmp":
    case "":
      return new CustomRtmpProvider();

    default:
      console.warn(`[streaming] Unknown STREAM_PROVIDER="${providerName}", falling back to "custom".`);
      return new CustomRtmpProvider();
  }
}
