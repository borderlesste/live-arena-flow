import { createHash, timingSafeEqual } from "node:crypto";

function unavailable(status: 401 | 502 | 503, code: string) {
  return Response.json({ ok: false, code }, { status, headers: { "cache-control": "no-store" } });
}

function secretMatches(received: string | null, expected: string) {
  const provided = received?.replace(/^Bearer\s+/i, "") ?? "";
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return unavailable(503, "CRON_NOT_CONFIGURED");
  if (!secretMatches(request.headers.get("authorization"), secret)) return unavailable(401, "CRON_UNAUTHORIZED");
  const configuredOrigin = process.env.API_INTERNAL_URL?.trim();
  if (!configuredOrigin) return unavailable(503, "API_UPSTREAM_NOT_CONFIGURED");
  let target: URL;
  try {
    target = new URL("/api/internal/analytics/sync", configuredOrigin);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new Error("invalid");
  } catch {
    return unavailable(503, "API_UPSTREAM_INVALID");
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(target, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) return unavailable(502, "ANALYTICS_SYNC_UPSTREAM_FAILED");
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return unavailable(502, "API_UPSTREAM_UNAVAILABLE");
  }
}
