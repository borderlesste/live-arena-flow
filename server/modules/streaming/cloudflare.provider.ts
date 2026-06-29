/**
 * CloudflareStreamProvider
 *
 * Implements the LiveStreamProvider interface using Cloudflare Stream Live Inputs API.
 * All calls to Cloudflare are made exclusively from this server-side module.
 * The API token never reaches the frontend or logs.
 *
 * Docs: https://developers.cloudflare.com/stream/stream-live/start-stream-live/
 */

import { z } from "zod";
import type {
  CreatedLiveInput,
  CreateLiveInputInput,
  LiveInputStatus,
  LiveStreamProvider,
  RotatedLiveInputCredentials,
} from "./types.js";

// ── Cloudflare API response validation ────────────────────────────────────────

const cfRtmpsSchema = z.object({
  url: z.string().min(1),
  streamKey: z.string().min(1),
});

const cfStatusSchema = z.object({
  current: z.object({
    state: z.string(),
  }).optional(),
}).optional();

const cfLiveInputSchema = z.object({
  uid: z.string().min(1),
  rtmps: cfRtmpsSchema,
  status: cfStatusSchema,
  meta: z.record(z.string()).optional(),
  created: z.string().optional(),
  modified: z.string().optional(),
});

const cfApiResponseSchema = z.object({
  success: z.boolean(),
  result: cfLiveInputSchema.optional(),
  errors: z.array(z.object({ code: z.number(), message: z.string() })).optional(),
});

type CfLiveInputState =
  | "connected"
  | "reconnected"
  | "reconnecting"
  | "client_disconnect"
  | "ttl_exceeded"
  | "failed_to_connect"
  | "failed_to_reconnect"
  | "new_configuration_accepted"
  | string;

function mapCfStateToInternal(state: CfLiveInputState | undefined): LiveInputStatus {
  if (!state) return "ready";
  switch (state) {
    case "connected":
    case "reconnected":
      return "live";
    case "reconnecting":
      return "reconnecting";
    case "client_disconnect":
    case "ttl_exceeded":
      return "disconnected";
    case "failed_to_connect":
    case "failed_to_reconnect":
      return "provider_error";
    case "new_configuration_accepted":
      return "ready";
    default:
      return "ready";
  }
}

// ── Config validation ─────────────────────────────────────────────────────────

function getConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim()
    || process.env.CLOUDFLARE_API_TOKEN?.trim();
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();
  const timeoutMs = Number(process.env.CLOUDFLARE_STREAM_API_TIMEOUT_MS || 15_000);
  const recordingMode = (process.env.CLOUDFLARE_STREAM_RECORDING_MODE || "off") as "off" | "automatic";
  const requireSignedUrls = process.env.CLOUDFLARE_STREAM_REQUIRE_SIGNED_URLS === "true";
  const allowedOrigins = (process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const deleteAfterDays = process.env.CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS
    ? Number(process.env.CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS)
    : undefined;

  if (!accountId) throw new Error("[CloudflareStreamProvider] CLOUDFLARE_ACCOUNT_ID is required");
  if (!apiToken) throw new Error("[CloudflareStreamProvider] CLOUDFLARE_STREAM_API_TOKEN (or CLOUDFLARE_API_TOKEN) is required");

  return { accountId, apiToken, customerCode, timeoutMs, recordingMode, requireSignedUrls, allowedOrigins, deleteAfterDays };
}

// ── HLS URL builder ───────────────────────────────────────────────────────────

export function buildCloudflareHlsUrl(customerCode: string, liveInputUid: string): string {
  if (!customerCode || typeof customerCode !== "string") {
    throw new Error("[CloudflareStreamProvider] customerCode is required to build HLS URL");
  }
  if (!liveInputUid || typeof liveInputUid !== "string") {
    throw new Error("[CloudflareStreamProvider] liveInputUid is required to build HLS URL");
  }
  // Validate uid format (alphanumeric, 32 chars typical)
  if (!/^[a-zA-Z0-9]+$/.test(liveInputUid)) {
    throw new Error("[CloudflareStreamProvider] Invalid liveInputUid format");
  }
  return `https://customer-${customerCode}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`;
}

// ── Provider class ────────────────────────────────────────────────────────────

export class CloudflareStreamProvider implements LiveStreamProvider {
  readonly name = "cloudflare_stream";

  private baseUrl(accountId: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`;
  }

  private headers(apiToken: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    apiToken: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<T> {
    let lastError: unknown;
    const maxAttempts = method === "POST" ? 1 : 3; // POST is not idempotent — no retry
    const retryableCodes = new Set([429, 500, 502, 503, 504]);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers: this.headers(apiToken),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!res.ok) {
          const shouldRetry = retryableCodes.has(res.status) && attempt < maxAttempts;
          if (!shouldRetry) {
            // Sanitize: never log the full response body (may contain tokens)
            throw new Error(`CLOUDFLARE_HTTP_${res.status}`);
          }
          // Exponential backoff with jitter
          const delay = Math.min(1000 * 2 ** (attempt - 1) + Math.random() * 100, 8000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const json: unknown = await res.json();
        return json as T;
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("CLOUDFLARE_TIMEOUT");
        }
        if (attempt >= maxAttempts) break;
        const delay = 200 * 2 ** (attempt - 1) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("CLOUDFLARE_NETWORK_ERROR");
  }

  async createLiveInput(input: CreateLiveInputInput): Promise<CreatedLiveInput> {
    const cfg = getConfig();

    const payload: Record<string, unknown> = {
      enabled: true,
      meta: {
        name: input.name,
        environment: process.env.NODE_ENV || "production",
      },
      recording: {
        mode: cfg.recordingMode,
        requireSignedURLs: cfg.requireSignedUrls,
        ...(cfg.allowedOrigins.length > 0 && { allowedOrigins: cfg.allowedOrigins }),
        ...(cfg.recordingMode === "automatic" && cfg.deleteAfterDays !== undefined
          ? { timeoutSeconds: 0, deletedAfterDays: cfg.deleteAfterDays }
          : {}),
      },
    };

    const raw = await this.request<unknown>(
      "POST",
      this.baseUrl(cfg.accountId),
      cfg.apiToken,
      cfg.timeoutMs,
      payload,
    );

    const parsed = cfApiResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.success || !parsed.data.result) {
      const errorCodes = parsed.data?.errors?.map((e) => e.code).join(",") || "UNKNOWN";
      throw new Error(`CLOUDFLARE_LIVE_INPUT_CREATE_FAILED:${errorCodes}`);
    }

    const result = parsed.data.result;

    // Strict validation: must have uid + rtmps.url + rtmps.streamKey
    if (!result.uid || !result.rtmps?.url || !result.rtmps?.streamKey) {
      throw new Error("CLOUDFLARE_LIVE_INPUT_INVALID_RESPONSE");
    }

    // Build HLS playback URL
    let playbackUrl: string | null = null;
    if (cfg.customerCode) {
      try {
        playbackUrl = buildCloudflareHlsUrl(cfg.customerCode, result.uid);
      } catch {
        // Non-fatal: playbackUrl can be built later when customerCode is added
        playbackUrl = null;
      }
    }

    return {
      provider: this.name,
      providerInputId: result.uid,
      ingestProtocol: "rtmps",
      ingestUrl: result.rtmps.url,
      streamKey: result.rtmps.streamKey,
      playbackFormat: "hls",
      playbackUrl,
      status: "ready",
    };
  }

  async getLiveInputStatus(providerInputId: string): Promise<LiveInputStatus> {
    const cfg = getConfig();
    try {
      const raw = await this.request<unknown>(
        "GET",
        `${this.baseUrl(cfg.accountId)}/${encodeURIComponent(providerInputId)}`,
        cfg.apiToken,
        cfg.timeoutMs,
      );
      const parsed = cfApiResponseSchema.safeParse(raw);
      if (!parsed.success || !parsed.data.success || !parsed.data.result) {
        return "provider_error";
      }
      return mapCfStateToInternal(parsed.data.result.status?.current?.state);
    } catch {
      return "provider_error";
    }
  }

  /** Retrieve live credentials from Cloudflare (for /credentials/reveal endpoint). */
  async getCredentials(providerInputId: string): Promise<{ ingestUrl: string; ingestProtocol: "rtmps"; streamKey: string }> {
    const cfg = getConfig();
    const raw = await this.request<unknown>(
      "GET",
      `${this.baseUrl(cfg.accountId)}/${encodeURIComponent(providerInputId)}`,
      cfg.apiToken,
      cfg.timeoutMs,
    );
    const parsed = cfApiResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.success || !parsed.data.result) {
      throw new Error("CLOUDFLARE_GET_CREDENTIALS_FAILED");
    }
    const result = parsed.data.result;
    if (!result.rtmps?.url || !result.rtmps?.streamKey) {
      throw new Error("CLOUDFLARE_CREDENTIALS_MISSING");
    }
    return {
      ingestUrl: result.rtmps.url,
      ingestProtocol: "rtmps",
      streamKey: result.rtmps.streamKey,
    };
  }

  async disableLiveInput(providerInputId: string): Promise<void> {
    const cfg = getConfig();
    await this.request<unknown>(
      "PUT",
      `${this.baseUrl(cfg.accountId)}/${encodeURIComponent(providerInputId)}`,
      cfg.apiToken,
      cfg.timeoutMs,
      { enabled: false },
    );
  }

  async enableLiveInput(providerInputId: string): Promise<void> {
    const cfg = getConfig();
    await this.request<unknown>(
      "PUT",
      `${this.baseUrl(cfg.accountId)}/${encodeURIComponent(providerInputId)}`,
      cfg.apiToken,
      cfg.timeoutMs,
      { enabled: true },
    );
  }

  async deleteLiveInput(providerInputId: string): Promise<void> {
    const cfg = getConfig();
    await this.request<unknown>(
      "DELETE",
      `${this.baseUrl(cfg.accountId)}/${encodeURIComponent(providerInputId)}`,
      cfg.apiToken,
      cfg.timeoutMs,
    );
  }

  /**
   * Cloudflare does not support rotating only the stream key.
   * "Rotation" here creates a new Live Input (handled by the server route).
   * This method is intentionally not implemented on the provider —
   * the server handles the full reprovision saga.
   */
  rotateCredentials?: undefined;
}
