import { describe, expect, it } from "vitest";
import { pickAdapter } from "./streaming.service";
import type { StreamSource, StreamType } from "@/types";

function source(type: StreamType): StreamSource {
  const embedded = ["youtube", "youtube_live", "embed", "iframe"].includes(type);
  return {
    id: type,
    type,
    title: type,
    isExternal: embedded,
    ...(embedded
      ? { embedUrl: "https://www.youtube-nocookie.com/embed/abc123" }
      : { url: "https://cdn.example.com/media/source" }),
  };
}

describe("player adapter selection", () => {
  it.each(["hls", "obs_hls"] as const)("uses HLS for %s", (type) => {
    expect(pickAdapter(source(type))).toBe("hls");
  });

  it.each(["mp4", "mp3"] as const)("uses native media for %s", (type) => {
    expect(pickAdapter(source(type))).toBe("html5");
  });

  it.each(["youtube", "youtube_live", "embed", "iframe"] as const)("uses a sandboxed embed for %s", (type) => {
    expect(pickAdapter(source(type))).toBe("embed");
  });
});
