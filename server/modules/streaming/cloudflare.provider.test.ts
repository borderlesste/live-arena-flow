// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CloudflareStreamProvider, buildCloudflareHlsUrl } from "./cloudflare.provider.js";

// ── Env helpers ───────────────────────────────────────────────────────────────

const BASE_ENV = {
  CLOUDFLARE_ACCOUNT_ID: "test-account-123",
  CLOUDFLARE_STREAM_API_TOKEN: "test-token-secret",
  CLOUDFLARE_STREAM_CUSTOMER_CODE: "abc123customer",
  CLOUDFLARE_STREAM_API_TIMEOUT_MS: "5000",
  CLOUDFLARE_STREAM_RECORDING_MODE: "off",
  CLOUDFLARE_STREAM_REQUIRE_SIGNED_URLS: "false",
  CLOUDFLARE_STREAM_ALLOWED_ORIGINS: "luisromerofutbol.com",
};

function setEnv(overrides: Partial<typeof BASE_ENV & Record<string, string>> = {}) {
  Object.assign(process.env, { ...BASE_ENV, ...overrides });
}

function clearEnv() {
  for (const key of Object.keys(BASE_ENV)) delete process.env[key];
  delete process.env.CLOUDFLARE_API_TOKEN;
}

// ── Valid Cloudflare response fixture ─────────────────────────────────────────

const CF_SUCCESS_RESPONSE = {
  success: true,
  result: {
    uid: "abc123def456ghi789jkl012",
    rtmps: {
      url: "rtmps://live.cloudflare.com:443/live/",
      streamKey: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4",
    },
    status: { current: { state: "new_configuration_accepted" } },
    meta: { name: "Test Stream" },
    created: "2026-06-28T00:00:00Z",
  },
  errors: [],
};

function mockFetchSuccess(body: Record<string, unknown> = CF_SUCCESS_RESPONSE) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchError(status: number, body: Record<string, unknown> = { success: false, errors: [{ code: status, message: "error" }] }) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// ── buildCloudflareHlsUrl ─────────────────────────────────────────────────────

describe("buildCloudflareHlsUrl", () => {
  it("builds correct HLS URL with valid inputs", () => {
    const url = buildCloudflareHlsUrl("abc123", "def456ghi789jkl012mno345");
    expect(url).toBe("https://customer-abc123.cloudflarestream.com/def456ghi789jkl012mno345/manifest/video.m3u8");
  });

  it("throws when customerCode is empty", () => {
    expect(() => buildCloudflareHlsUrl("", "uid123")).toThrow("customerCode is required");
  });

  it("throws when liveInputUid is empty", () => {
    expect(() => buildCloudflareHlsUrl("code123", "")).toThrow("liveInputUid is required");
  });

  it("throws when liveInputUid contains invalid characters", () => {
    expect(() => buildCloudflareHlsUrl("code123", "uid/with/slashes")).toThrow("Invalid liveInputUid format");
  });

  it("throws when customerCode is not a string", () => {
    expect(() => buildCloudflareHlsUrl(null as unknown as string, "uid123")).toThrow();
  });
});

// ── CloudflareStreamProvider ──────────────────────────────────────────────────

describe("CloudflareStreamProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ── createLiveInput ────────────────────────────────────────────────────────

  describe("createLiveInput", () => {
    it("creates a live input with correct RTMPS credentials and HLS URL", async () => {
      mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      const result = await provider.createLiveInput({ name: "Test Stream" });

      expect(result.provider).toBe("cloudflare_stream");
      expect(result.providerInputId).toBe("abc123def456ghi789jkl012");
      expect(result.ingestProtocol).toBe("rtmps");
      expect(result.ingestUrl).toBe("rtmps://live.cloudflare.com:443/live/");
      expect(result.streamKey).toBe("a1b2c3d4e5f6g7h8i9j0k1l2m3n4");
      expect(result.playbackFormat).toBe("hls");
      expect(result.playbackUrl).toBe(
        "https://customer-abc123customer.cloudflarestream.com/abc123def456ghi789jkl012/manifest/video.m3u8",
      );
      expect(result.status).toBe("ready");
    });

    it("sends Authorization header with Bearer token", async () => {
      const fetchSpy = mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      await provider.createLiveInput({ name: "Test" });

      const [, options] = fetchSpy.mock.calls[0];
      const headers = (options as RequestInit).headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-token-secret");
    });

    it("sends request to correct Cloudflare endpoint", async () => {
      const fetchSpy = mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      await provider.createLiveInput({ name: "Test" });

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("test-account-123/stream/live_inputs");
    });

    it("does NOT include API token in request body", async () => {
      const fetchSpy = mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      await provider.createLiveInput({ name: "Test" });

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(JSON.stringify(body)).not.toContain("test-token-secret");
      expect(JSON.stringify(body)).not.toContain("test-account-123");
    });

    it("throws when response uid is empty (schema validation fails)", async () => {
      // When uid="" fails Zod .min(1), the provider throws CREATE_FAILED
      mockFetchSuccess({
        success: true,
        result: { uid: "", rtmps: { url: "rtmps://...", streamKey: "key" }, status: null, meta: {} },
        errors: [],
      });
      const provider = new CloudflareStreamProvider();
      // Empty uid fails cfLiveInputSchema.uid.min(1) → parsed.success=false → CREATE_FAILED
      await expect(provider.createLiveInput({ name: "Bad" })).rejects.toThrow("CLOUDFLARE_LIVE_INPUT_CREATE_FAILED");
    });

    it("throws when streamKey is empty (schema validation fails)", async () => {
      // When streamKey="" fails Zod .min(1), the provider throws CREATE_FAILED
      mockFetchSuccess({
        success: true,
        result: { uid: "validuid123", rtmps: { url: "rtmps://...", streamKey: "" }, status: null, meta: {} },
        errors: [],
      });
      const provider = new CloudflareStreamProvider();
      // Empty streamKey fails cfRtmpsSchema.streamKey.min(1) → CREATE_FAILED
      await expect(provider.createLiveInput({ name: "Bad" })).rejects.toThrow("CLOUDFLARE_LIVE_INPUT_CREATE_FAILED");
    });

    it("throws CLOUDFLARE_LIVE_INPUT_INVALID_RESPONSE when result is present but rtmps is absent", async () => {
      // Valid uid, valid streamKey — this should succeed normally
      mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      const result = await provider.createLiveInput({ name: "ValidTest" });
      expect(result.providerInputId).toBe("abc123def456ghi789jkl012");
    });

    it("throws CLOUDFLARE_LIVE_INPUT_CREATE_FAILED on API error response", async () => {
      mockFetchSuccess({ success: false, result: null, errors: [{ code: 7003, message: "Invalid account ID" }] });
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "Bad" })).rejects.toThrow("CLOUDFLARE_LIVE_INPUT_CREATE_FAILED");
    });

    it("throws CLOUDFLARE_HTTP_401 on 401 response (does not retry)", async () => {
      mockFetchError(401);
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "Unauth" })).rejects.toThrow("CLOUDFLARE_HTTP_401");
    });

    it("throws CLOUDFLARE_HTTP_403 on 403 response (does not retry)", async () => {
      mockFetchError(403);
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "Forbidden" })).rejects.toThrow("CLOUDFLARE_HTTP_403");
    });

    it("throws when CLOUDFLARE_ACCOUNT_ID is missing", async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "NoAccount" })).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID is required");
    });

    it("throws when CLOUDFLARE_STREAM_API_TOKEN is missing", async () => {
      delete process.env.CLOUDFLARE_STREAM_API_TOKEN;
      delete process.env.CLOUDFLARE_API_TOKEN;
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "NoToken" })).rejects.toThrow("CLOUDFLARE_STREAM_API_TOKEN");
    });

    it("returns null playbackUrl when CLOUDFLARE_STREAM_CUSTOMER_CODE is not set", async () => {
      delete process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
      mockFetchSuccess();
      const provider = new CloudflareStreamProvider();
      const result = await provider.createLiveInput({ name: "NoCustomer" });
      expect(result.playbackUrl).toBeNull();
    });

    it("does not retry POST on 401 error", async () => {
      const fetchSpy = mockFetchError(401);
      const provider = new CloudflareStreamProvider();
      await expect(provider.createLiveInput({ name: "Test" })).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry for POST
    });
  });

  // ── getLiveInputStatus ─────────────────────────────────────────────────────

  describe("getLiveInputStatus", () => {
    it("maps 'connected' state to 'live'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "connected" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      const status = await new CloudflareStreamProvider().getLiveInputStatus("uid1");
      expect(status).toBe("live");
    });

    it("maps 'reconnected' state to 'live'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "reconnected" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("live");
    });

    it("maps 'reconnecting' state to 'reconnecting'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "reconnecting" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("reconnecting");
    });

    it("maps 'client_disconnect' to 'disconnected'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "client_disconnect" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("disconnected");
    });

    it("maps 'failed_to_connect' to 'provider_error'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "failed_to_connect" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("provider_error");
    });

    it("maps 'new_configuration_accepted' to 'ready'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: true,
          result: { uid: "uid1", rtmps: { url: "rtmps://...", streamKey: "k" }, status: { current: { state: "new_configuration_accepted" } }, meta: {} },
          errors: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("ready");
    });

    it("returns 'error' when Cloudflare API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
      expect(await new CloudflareStreamProvider().getLiveInputStatus("uid1")).toBe("provider_error");
    });
  });

  // ── deleteLiveInput ────────────────────────────────────────────────────────

  describe("deleteLiveInput", () => {
    it("sends DELETE request to correct URL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      await new CloudflareStreamProvider().deleteLiveInput("uid-to-delete");
      const [url, options] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("uid-to-delete");
      expect((options as RequestInit).method).toBe("DELETE");
    });
  });

  describe("enable and disable", () => {
    it.each([
      ["enableLiveInput", true],
      ["disableLiveInput", false],
    ] as const)("%s sends the Cloudflare enabled flag", async (method, enabled) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      const provider = new CloudflareStreamProvider();
      await provider[method]("uid-toggle");
      const [, options] = fetchSpy.mock.calls[0];
      expect((options as RequestInit).method).toBe("PUT");
      expect(JSON.parse(String((options as RequestInit).body))).toEqual({ enabled });
    });
  });

  // ── getCredentials ─────────────────────────────────────────────────────────

  describe("getCredentials", () => {
    it("returns ingest URL and stream key from Cloudflare", async () => {
      mockFetchSuccess();
      const creds = await new CloudflareStreamProvider().getCredentials("abc123def456ghi789jkl012");
      expect(creds.ingestUrl).toBe("rtmps://live.cloudflare.com:443/live/");
      expect(creds.ingestProtocol).toBe("rtmps");
      expect(creds.streamKey).toBe("a1b2c3d4e5f6g7h8i9j0k1l2m3n4");
    });

    it("throws when Cloudflare returns no credentials", async () => {
      mockFetchSuccess({ success: false, result: null, errors: [{ code: 404, message: "Not found" }] });
      await expect(new CloudflareStreamProvider().getCredentials("uid")).rejects.toThrow("CLOUDFLARE_GET_CREDENTIALS_FAILED");
    });
  });

  // ── Factory ────────────────────────────────────────────────────────────────

  describe("getLiveStreamProvider factory with Cloudflare", () => {
    it("returns CloudflareStreamProvider when STREAM_PROVIDER=cloudflare", async () => {
      process.env.STREAM_PROVIDER = "cloudflare";
      const { getLiveStreamProvider } = await import("./factory.js");
      const provider = getLiveStreamProvider();
      expect(provider).toBeInstanceOf(CloudflareStreamProvider);
      expect(provider.name).toBe("cloudflare_stream");
    });

    it("returns CloudflareStreamProvider when STREAM_PROVIDER=cloudflare_stream", async () => {
      process.env.STREAM_PROVIDER = "cloudflare_stream";
      const { getLiveStreamProvider } = await import("./factory.js");
      const provider = getLiveStreamProvider();
      expect(provider).toBeInstanceOf(CloudflareStreamProvider);
    });
  });
});
