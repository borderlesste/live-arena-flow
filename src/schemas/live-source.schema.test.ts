import { describe, expect, it } from "vitest";
import { createLiveSourceSchema } from "./live-source.schema";

const obsSource = {
  matchId: "match-1",
  title: "Señal principal",
  sourceKind: "obs" as const,
  usageType: "live" as const,
  playbackFormat: "hls",
};

describe("createLiveSourceSchema", () => {
  it.each(["configured", "direct_cloudflare"] as const)("accepts the %s OBS ingest mode", (ingestMode) => {
    expect(createLiveSourceSchema.parse({ ...obsSource, ingestMode }).ingestMode).toBe(ingestMode);
  });

  it("rejects provider selection for manual sources", () => {
    const result = createLiveSourceSchema.safeParse({
      ...obsSource,
      sourceKind: "manual",
      playbackUrl: "https://cdn.example.com/live.m3u8",
      ingestMode: "direct_cloudflare",
    });

    expect(result.success).toBe(false);
  });

  it("rejects arbitrary provider names", () => {
    expect(createLiveSourceSchema.safeParse({ ...obsSource, ingestMode: "attacker_provider" }).success).toBe(false);
  });
});
