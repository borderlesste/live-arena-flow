import { describe, expect, it } from "vitest";
import { embedUrlSchema, mediaUrlSchema, streamSourceSchema } from "./stream.schema";

describe("stream source validation", () => {
  it("accepts HTTPS HLS sources", () => {
    expect(mediaUrlSchema.safeParse("https://cdn.example.com/live/index.m3u8").success).toBe(true);
    expect(streamSourceSchema.safeParse({
      id: "primary",
      type: "hls",
      url: "https://cdn.example.com/live/index.m3u8",
      title: "Main feed",
      isExternal: false,
    }).success).toBe(true);
  });

  it("rejects insecure public media URLs", () => {
    expect(mediaUrlSchema.safeParse("http://cdn.example.com/live/index.m3u8").success).toBe(false);
  });

  it("rejects iframe providers outside the allowlist", () => {
    expect(embedUrlSchema.safeParse("https://attacker.example/embed/stream").success).toBe(false);
    expect(streamSourceSchema.safeParse({
      id: "external",
      type: "iframe",
      embedUrl: "https://attacker.example/embed/stream",
      title: "Unknown embed",
      isExternal: true,
    }).success).toBe(false);
  });

  it("accepts privacy-enhanced YouTube embeds", () => {
    expect(embedUrlSchema.safeParse("https://www.youtube-nocookie.com/embed/abc123").success).toBe(true);
  });

  it.each(["hls", "obs_hls", "mp4", "mp3"] as const)("accepts %s media sources", (type) => {
    expect(streamSourceSchema.safeParse({
      id: type,
      type,
      url: "https://cdn.example.com/media/source",
      title: type,
      isExternal: false,
    }).success).toBe(true);
  });

  it.each(["youtube", "youtube_live", "embed", "iframe"] as const)("accepts allowlisted %s sources", (type) => {
    expect(streamSourceSchema.safeParse({
      id: type,
      type,
      embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
      title: type,
      isExternal: true,
    }).success).toBe(true);
  });
});
