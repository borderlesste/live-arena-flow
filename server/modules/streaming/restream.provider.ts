import { z } from "zod";
import type {
  CreatedLiveInput,
  CreateLiveInputInput,
  LiveInputStatus,
  LiveStreamProvider,
  ProviderLiveInput,
} from "./types.js";

const RESTREAM_API_BASE_URL = "https://api.restream.io/v2/";
const ingestUrlSchema = z.string().url().refine((value) => {
  return ["rtmp:", "rtmps:", "srt:"].includes(new URL(value).protocol);
}, "RESTREAM_INGEST_URL must use RTMP, RTMPS, or SRT");

const restreamConfigSchema = z.object({
  accessToken: z.string().min(1).optional(),
  ingestUrl: ingestUrlSchema.optional(),
  streamKey: z.string().min(1).optional(),
  timeoutMs: z.number().int().min(1_000).max(60_000),
}).superRefine((value, ctx) => {
  if (value.accessToken || (value.ingestUrl && value.streamKey)) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Configure RESTREAM_ACCESS_TOKEN or RESTREAM_INGEST_URL and RESTREAM_STREAM_KEY",
  });
});

const selectedIngestSchema = z.object({ ingestId: z.number().int().nonnegative() });
const streamKeySchema = z.object({
  streamKey: z.string().min(1),
  srtUrl: z.string().nullable().optional(),
});
const ingestServerSchema = z.object({
  id: z.number().int().nonnegative(),
  rtmpUrl: z.string().min(1),
});

type RestreamConfig = z.infer<typeof restreamConfigSchema>;

export function getRestreamConfig(): RestreamConfig {
  return restreamConfigSchema.parse({
    accessToken: process.env.RESTREAM_ACCESS_TOKEN?.trim() || undefined,
    ingestUrl: process.env.RESTREAM_INGEST_URL?.trim() || undefined,
    streamKey: process.env.RESTREAM_STREAM_KEY?.trim() || undefined,
    timeoutMs: Number(process.env.RESTREAM_API_TIMEOUT_MS || 15_000),
  });
}

function ingestProtocol(url: string): "rtmp" | "rtmps" | "srt" {
  const protocol = new URL(url).protocol;
  if (protocol === "rtmp:") return "rtmp";
  if (protocol === "rtmps:") return "rtmps";
  if (protocol === "srt:") return "srt";
  throw new Error("RESTREAM_INGEST_URL_INVALID");
}

export class RestreamProvider implements LiveStreamProvider {
  readonly name = "restream";

  private async request(path: string, authenticated: boolean): Promise<unknown> {
    const config = getRestreamConfig();
    const response = await fetch(new URL(path, RESTREAM_API_BASE_URL), {
      headers: {
        Accept: "application/json",
        ...(authenticated && config.accessToken
          ? { Authorization: `Bearer ${config.accessToken}` }
          : {}),
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error(`RESTREAM_HTTP_${response.status}`);
    return response.json();
  }

  private async credentials() {
    const config = getRestreamConfig();
    if (config.ingestUrl && config.streamKey) {
      return {
        providerInputId: "restream-static",
        ingestUrl: config.ingestUrl,
        ingestProtocol: ingestProtocol(config.ingestUrl),
        streamKey: config.streamKey,
      } as const;
    }

    const [selectedRaw, streamKeyRaw, serversRaw] = await Promise.all([
      this.request("user/ingest", true),
      this.request("user/streamKey", true),
      this.request("server/all", false),
    ]);
    const selected = selectedIngestSchema.parse(selectedRaw);
    const stream = streamKeySchema.parse(streamKeyRaw);
    const servers = z.array(ingestServerSchema).parse(serversRaw);
    const selectedServer = servers.find((server) => server.id === selected.ingestId)
      ?? servers.find((server) => server.id === 20);
    if (!selectedServer) throw new Error("RESTREAM_INGEST_SERVER_NOT_FOUND");

    return {
      providerInputId: `restream-ingest-${selected.ingestId}`,
      ingestUrl: selectedServer.rtmpUrl,
      ingestProtocol: ingestProtocol(selectedServer.rtmpUrl),
      streamKey: stream.streamKey,
    } as const;
  }

  async createLiveInput(_input: CreateLiveInputInput): Promise<CreatedLiveInput> {
    const credentials = await this.credentials();
    return {
      provider: this.name,
      ...credentials,
      playbackFormat: "hls",
      playbackUrl: null,
      status: "ready",
    };
  }

  async getLiveInput(providerInputId: string): Promise<ProviderLiveInput> {
    const credentials = await this.credentials();
    return {
      ...credentials,
      providerInputId,
      enabled: true,
      status: "ready",
    };
  }

  async getCredentials() {
    const { ingestUrl, ingestProtocol, streamKey } = await this.credentials();
    return { ingestUrl, ingestProtocol, streamKey };
  }

  async getLiveInputStatus(_providerInputId: string): Promise<LiveInputStatus> {
    return "ready";
  }

  async disableLiveInput(_providerInputId: string): Promise<void> {}
  async enableLiveInput(_providerInputId: string): Promise<void> {}
  async deleteLiveInput(_providerInputId: string): Promise<void> {}
}
