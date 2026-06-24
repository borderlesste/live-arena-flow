import { expect, test } from "@playwright/test";

const adminToken = process.env.QA_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || "qa-admin-token";

function qaSource(overrides: Record<string, unknown> = {}) {
  return {
    id: `qa_security_${Date.now()}`,
    matchId: "qa_match_security",
    createdAt: new Date().toISOString(),
    type: "hls",
    url: "https://cdn.example.com/live/index.m3u8",
    title: "qa_stream_security",
    isExternal: false,
    purpose: "live",
    ...overrides,
  };
}

test.describe("seguridad de endpoints admin de live", () => {
  test("rechaza mutaciones admin sin sesion", async ({ request }) => {
    const response = await request.put("/api/admin/video-sources", { data: qaSource() });
    expect(response.status()).toBe(403);
  });

  test("rechaza media publica insegura aun con credencial admin", async ({ request }) => {
    const response = await request.put("/api/admin/video-sources", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: qaSource({ url: "http://cdn.example.com/live/index.m3u8" }),
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.issues)).toBe(true);
  });

  test("rechaza embeds fuera de allowlist aun con credencial admin", async ({ request }) => {
    const response = await request.put("/api/admin/video-sources", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: qaSource({
        type: "iframe",
        url: undefined,
        embedUrl: "https://attacker.example/embed/stream",
        isExternal: true,
      }),
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.issues)).toBe(true);
  });

  test("no expone stream keys OBS al listar fuentes gestionadas", async ({ request }) => {
    const id = `qa_security_obs_${Date.now()}`;
    try {
      const response = await request.put("/api/admin/video-sources", {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: qaSource({
          id,
          obs: {
            protocol: "rtmp",
            serverUrl: "rtmp://ingest.example.com/live",
            streamKey: "qa-secret-stream-key",
          },
        }),
      });
      expect(response.ok()).toBe(true);
      const sources = await response.json();
      const created = sources.find((source: { id: string }) => source.id === id);
      expect(created?.obs?.hasStreamKey).toBe(true);
      expect(created?.obs?.streamKey).toBeUndefined();
      expect(JSON.stringify(created)).not.toContain("qa-secret-stream-key");
    } finally {
      await request.delete(`/api/admin/video-sources/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
  });
});
