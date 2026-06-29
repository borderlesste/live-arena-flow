import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import type { CreatedLiveInput, CreateLiveInputInput, LiveInputStatus, LiveStreamProvider, RotatedLiveInputCredentials } from "./types.js";

export class CustomRtmpProvider implements LiveStreamProvider {
  readonly name = "custom";

  async createLiveInput(input: CreateLiveInputInput): Promise<CreatedLiveInput> {
    const providerInputId = randomUUID();
    const streamKey = randomBytes(12).toString("base64url");
    const ingestBase = (process.env.STREAM_INGEST_URL || "rtmp://127.0.0.1/live").replace(/\/$/, "");

    const protocol = ingestBase.startsWith("rtmps") ? "rtmps" as const : ingestBase.startsWith("srt") ? "srt" as const : "rtmp" as const;

    return {
      provider: this.name,
      providerInputId,
      ingestProtocol: protocol,
      ingestUrl: ingestBase,
      streamKey,
      playbackFormat: "hls",
      // A publishing key must never become part of a public playback URL.
      // Custom sources fail closed until an independent HTTPS URL is configured.
      playbackUrl: null,
      status: "ready",
    };
  }

  async getLiveInputStatus(providerInputId: string): Promise<LiveInputStatus> {
    const apiUrl = process.env.STREAM_API_URL;
    if (!apiUrl) {
      return "ready";
    }

    try {
      const res = await fetch(`${apiUrl}/v3/paths/list`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return "ready";
      const parsed = z.object({
        items: z.array(z.object({ sourceReady: z.boolean().optional() })).default([]),
      }).safeParse(await res.json());
      if (!parsed.success) return "ready";
      const pathActive = parsed.data.items.some((item) => item.sourceReady === true);
      return pathActive ? "live" : "ready";
    } catch {
      return "ready";
    }
  }

  async disableLiveInput(providerInputId: string): Promise<void> {
    // Optional integration with custom RTMP servers (e.g. MediaMTX API to close path)
  }

  async enableLiveInput(providerInputId: string): Promise<void> {
    // Optional integration
  }

  async deleteLiveInput(providerInputId: string): Promise<void> {
    // Optional integration
  }

  async rotateCredentials(providerInputId: string): Promise<RotatedLiveInputCredentials> {
    const streamKey = randomBytes(12).toString("base64url");
    const ingestBase = (process.env.STREAM_INGEST_URL || "rtmp://127.0.0.1/live").replace(/\/$/, "");
    return {
      streamKey,
      ingestUrl: ingestBase,
    };
  }
}
