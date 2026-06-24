import { isEmbedAllowed, isMediaAllowed } from "@/schemas/stream.schema";
import type { StreamSource, StreamType } from "@/types";

export type PlayerAdapter = "hls" | "html5" | "embed" | "unsupported";

export function pickAdapter(source: StreamSource): PlayerAdapter {
  switch (source.type) {
    case "hls":
    case "obs_hls":
      return isMediaAllowed(source.url) ? "hls" : "unsupported";
    case "mp4":
    case "mp3":
      return isMediaAllowed(source.url) ? "html5" : "unsupported";
    case "embed":
    case "iframe":
    case "youtube":
    case "youtube_live":
      return isEmbedAllowed(source.embedUrl) ? "embed" : "unsupported";
    default:
      return "unsupported";
  }
}

export function describeStreamType(type: StreamType): string {
  switch (type) {
    case "hls": return "HLS";
    case "obs_hls": return "OBS a HLS";
    case "mp4": return "Video MP4";
    case "mp3": return "Audio MP3";
    case "youtube": return "YouTube";
    case "youtube_live": return "YouTube Live";
    case "embed": return "URL embed";
    case "iframe": return "Iframe autorizado";
  }
}
