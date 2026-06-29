import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("API proxy", () => {
  it("returns 503 instead of falling back to localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(
      new Request("https://app.example.com/api/health"),
      context(["health"]),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "API_UPSTREAM_NOT_CONFIGURED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 502 when the configured backend cannot be reached", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "https://api.example.com");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(
      new Request("https://app.example.com/api/news"),
      context(["news"]),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "API_UPSTREAM_UNAVAILABLE" });
  });

  it("preserves the path, query and upstream response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "https://api.example.com");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ events: [] }, { status: 200, headers: { "x-upstream": "sports" } }),
    );

    const response = await GET(
      new Request("https://app.example.com/api/sports/events?date=2026-06-29"),
      context(["sports", "events"]),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://api.example.com/api/sports/events?date=2026-06-29"),
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-upstream")).toBe("sports");
    expect(await response.json()).toEqual({ events: [] });
  });

  it("preserves Unicode and suspicious mojibake fixtures without blind repair", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "https://api.example.com");
    const payload = {
      valid: [
        "Información",
        "Contraseña",
        "Niño",
        "São Paulo",
        "Español",
        "Ação",
        "€100",
        "“Comillas”",
        "‘Comillas simples’",
        "José",
        "República Dominicana",
        "😀",
        "中文",
        "العربية",
      ],
      suspiciousFixtures: [
        "InformaciÃ³n",
        "ContraseÃ±a",
        "SÃ£o Paulo",
        "â€œtextoâ€",
        "InformaciÃƒÂ³n",
        "�",
      ],
      xssFixture: "<script>alert('utf8')</script>",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload));

    const response = await GET(
      new Request("https://app.example.com/api/content"),
      context(["content"]),
    );

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(payload);
  });
});
