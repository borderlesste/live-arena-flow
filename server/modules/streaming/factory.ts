import { CustomRtmpProvider } from "./providers.js";
import type { LiveStreamProvider } from "./types.js";

/**
 * Returns the configured live stream provider.
 * Currently only "custom" (RTMP/RTMPS/SRT via CustomRtmpProvider) is supported.
 * Set STREAM_PROVIDER=custom (or leave unset) to use the custom RTMP provider.
 * Future providers can be added here when needed.
 */
export function getLiveStreamProvider(): LiveStreamProvider {
  const providerName = (process.env.STREAM_PROVIDER || "custom").toLowerCase().trim();

  switch (providerName) {
    case "custom":
    case "rtmp":
    case "":
      return new CustomRtmpProvider();
    default:
      // Unknown provider — warn and fall back to custom RTMP
      console.warn(`[streaming] Unknown STREAM_PROVIDER="${providerName}", falling back to "custom".`);
      return new CustomRtmpProvider();
  }
}
