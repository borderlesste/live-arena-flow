/**
 * Streaming service — adapter selection and notes.
 *
 * IMPORTANT: This app NEVER plays RTMP directly in the browser.
 * If a creator publishes via OBS over RTMP, they must push to an
 * intermediate ingest server (e.g. nginx-rtmp, MediaMTX, Cloudflare Stream,
 * Mux, AWS IVS) that exposes HLS (.m3u8), low-latency HLS, WebRTC (WHEP)
 * or an authorized embed. The browser then consumes that derived stream.
 *
 * Backend responsibilities (NOT implemented here):
 *  - URL signing / token-gated playback
 *  - Geo & rights restrictions
 *  - DVR / catch-up windows
 *  - Concurrency / device limits
 *  - Real moderation, chat persistence, WebSocket transport
 */

import type { StreamSource, StreamType } from "@/types";
import { isEmbedAllowed, isMediaAllowed } from "@/schemas/stream.schema";

export type PlayerAdapter = "hls" | "html5" | "embed" | "unsupported";

export function pickAdapter(source: StreamSource): PlayerAdapter {
  if (!source) return "unsupported";
  switch (source.type) {
    case "hls":
      return isMediaAllowed(source.url) ? "hls" : "unsupported";
    case "html5":
      return isMediaAllowed(source.url) ? "html5" : "unsupported";
    case "iframe":
    case "youtube":
    case "tiktok":
      return isEmbedAllowed(source.embedUrl) ? "embed" : "unsupported";
    case "webrtc":
      // WebRTC playback requires a WHEP/SDP signaling backend — not wired here.
      return "unsupported";
    default:
      return "unsupported";
  }
}

export function describeStreamType(t: StreamType): string {
  switch (t) {
    case "hls": return "HLS";
    case "html5": return "Vídeo HTML5";
    case "webrtc": return "WebRTC";
    case "youtube": return "YouTube";
    case "tiktok": return "TikTok";
    case "iframe": return "Embed";
  }
}
