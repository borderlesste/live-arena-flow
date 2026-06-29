/**
 * Unit tests for video-sources.service.ts
 * All HTTP calls are mocked — no real backend required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listManagedVideoSources,
  createLiveSource,
  deleteManagedVideoSource,
  revealCredentials,
  rotateCredentials,
  enableLiveSource,
  disableLiveSource,
  listLiveSourcesStatuses,
} from "@/services/video-sources.service";

const TOKEN = "test-bearer-token";
const BASE = "/api";

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchError(status: number, errorMsg = "Error del servidor") {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: errorMsg }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

// ── listManagedVideoSources ───────────────────────────────────────────────────

describe("listManagedVideoSources", () => {
  it("GETs /api/admin/live-sources with Bearer token", async () => {
    const fetchSpy = mockFetch([]);
    await listManagedVideoSources(TOKEN);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/admin/live-sources`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) }),
    );
  });

  it("returns parsed JSON array on success", async () => {
    const sources = [{ id: "s1", title: "Señal 1", matchId: "m1", type: "hls", isExternal: false, createdAt: "2026-06-25T00:00:00Z" }];
    mockFetch(sources);
    const result = await listManagedVideoSources(TOKEN);
    expect(result).toEqual(sources);
  });

  it("throws when backend returns 403", async () => {
    mockFetchError(403, "No autorizado");
    await expect(listManagedVideoSources(TOKEN)).rejects.toThrow("No autorizado");
  });

  it("does NOT include stream keys in the response shape (backend contract)", async () => {
    const sources = [{ id: "s1", title: "OBS", matchId: "m1", type: "obs_hls", isExternal: false, createdAt: "2026-06-25T00:00:00Z", obs: { hasStreamKey: true } }];
    mockFetch(sources);
    const result = await listManagedVideoSources(TOKEN);
    expect((result[0] as unknown as Record<string, unknown>).streamKeyCiphertext).toBeUndefined();
  });
});

// ── createLiveSource ──────────────────────────────────────────────────────────

describe("createLiveSource", () => {
  const payload = {
    matchId: "m1",
    title: "Test OBS",
    sourceKind: "obs" as const,
    usageType: "live" as const,
    ingestProtocol: "rtmps" as const,
    recordingEnabled: false,
    lowLatencyEnabled: false,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
  };

  it("POSTs to /api/admin/live-sources with correct headers", async () => {
    const fetchSpy = mockFetch({ source: { id: "new-1", ...payload, type: "obs_hls", isExternal: false, createdAt: "2026-06-25T00:00:00Z" }, replayed: false });
    await createLiveSource(payload, TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources`);
    expect((options as RequestInit).method).toBe("POST");
    expect(((options as RequestInit).headers as Record<string, string>)["Idempotency-Key"]).toBe(payload.idempotencyKey);
    expect(((options as RequestInit).headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("includes the idempotency key in the request header", async () => {
    const uniqueKey = "22222222-2222-4222-8222-222222222222";
    const fetchSpy = mockFetch({ source: { id: "new-1", ...payload, type: "obs_hls", isExternal: false, createdAt: "2026-06-25T00:00:00Z" }, replayed: false });
    await createLiveSource({ ...payload, idempotencyKey: uniqueKey }, TOKEN);
    const [, options] = fetchSpy.mock.calls[0];
    expect(((options as RequestInit).headers as Record<string, string>)["Idempotency-Key"]).toBe(uniqueKey);
  });

  it("returns the created source including OBS credentials on success", async () => {
    const created = {
      id: "new-1", title: "Test OBS", matchId: "m1", type: "obs_hls", isExternal: false,
      createdAt: "2026-06-25T00:00:00Z",
      ingestUrl: "rtmps://ingest.example.com:443/live",
    };
    mockFetch({
      source: created,
      credentials: { ingestUrl: created.ingestUrl, ingestProtocol: "rtmps", streamKey: "realKey1234A92F" },
      replayed: false,
    });
    const result = await createLiveSource(payload, TOKEN);
    expect(result.source.id).toBe("new-1");
    expect(result.credentials?.streamKey).toBe("realKey1234A92F");
    expect(result.source.obs?.streamKey).toBeUndefined();
  });

  it("throws a descriptive error when provider fails (500)", async () => {
    mockFetchError(500, "Error al crear señal en el proveedor");
    await expect(createLiveSource(payload, TOKEN)).rejects.toThrow("Error al crear señal en el proveedor");
  });

  it("throws when backend returns 400 for missing playbackUrl on manual source", async () => {
    mockFetchError(400, "URL de reproducción requerida");
    await expect(
      createLiveSource({ ...payload, sourceKind: "manual", playbackUrl: undefined }, TOKEN),
    ).rejects.toThrow("URL de reproducción requerida");
  });
});

// ── deleteManagedVideoSource ──────────────────────────────────────────────────

describe("deleteManagedVideoSource", () => {
  it("sends DELETE to correct URL", async () => {
    const fetchSpy = mockFetch({ success: true });
    // deleteManagedVideoSource also calls listManagedVideoSources after deletion
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));
    await deleteManagedVideoSource("src-1", TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/src-1`);
    expect((options as RequestInit).method).toBe("DELETE");
  });

  it("throws when backend returns 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Fuente no encontrada" }), { status: 404, headers: { "Content-Type": "application/json" } }),
    );
    await expect(deleteManagedVideoSource("nonexistent", TOKEN)).rejects.toThrow("Fuente no encontrada");
  });
});

// ── revealCredentials ─────────────────────────────────────────────────────────

describe("revealCredentials", () => {
  it("POSTs to credentials/reveal endpoint", async () => {
    const fetchSpy = mockFetch({ ingestUrl: "rtmps://ingest.example.com/live", ingestProtocol: "rtmps", streamKey: "fullKey1234" });
    await revealCredentials("src-1", TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/src-1/credentials/reveal`);
    expect((options as RequestInit).method).toBe("POST");
  });

  it("returns the full stream key", async () => {
    mockFetch({ ingestUrl: "rtmps://ingest.example.com/live", ingestProtocol: "rtmps", streamKey: "fullSecretKey" });
    const result = await revealCredentials("src-1", TOKEN);
    expect(result.streamKey).toBe("fullSecretKey");
  });

  it("throws when not authorized", async () => {
    mockFetchError(403, "No autorizado");
    await expect(revealCredentials("src-1", TOKEN)).rejects.toThrow("No autorizado");
  });
});

// ── rotateCredentials ─────────────────────────────────────────────────────────

describe("rotateCredentials", () => {
  it("POSTs to credentials/rotate endpoint", async () => {
    const fetchSpy = mockFetch({ ingestUrl: "rtmps://ingest.example.com/live", ingestProtocol: "rtmps", streamKey: "newKey5678" });
    await rotateCredentials("src-1", TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/src-1/credentials/rotate`);
    expect((options as RequestInit).method).toBe("POST");
  });

  it("returns the new stream key", async () => {
    mockFetch({ ingestUrl: "rtmps://ingest.example.com/live", ingestProtocol: "rtmps", streamKey: "rotatedKey" });
    const result = await rotateCredentials("src-1", TOKEN);
    expect(result.streamKey).toBe("rotatedKey");
  });
});

// ── enableLiveSource / disableLiveSource ──────────────────────────────────────

describe("enableLiveSource / disableLiveSource", () => {
  it("POSTs to /enable endpoint", async () => {
    const fetchSpy = mockFetch({ success: true });
    await enableLiveSource("src-1", TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/src-1/enable`);
    expect((options as RequestInit).method).toBe("POST");
  });

  it("POSTs to /disable endpoint", async () => {
    const fetchSpy = mockFetch({ success: true });
    await disableLiveSource("src-1", TOKEN);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/src-1/disable`);
    expect((options as RequestInit).method).toBe("POST");
  });
});

// ── listLiveSourcesStatuses ───────────────────────────────────────────────────

describe("listLiveSourcesStatuses", () => {
  it("GETs /api/admin/live-sources/status", async () => {
    const fetchSpy = mockFetch([{ id: "src-1", status: "live" }]);
    await listLiveSourcesStatuses(TOKEN);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/admin/live-sources/status`);
  });

  it("returns status array", async () => {
    mockFetch([{ id: "src-1", status: "live" }, { id: "src-2", status: "ready" }]);
    const result = await listLiveSourcesStatuses(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("live");
  });
});
