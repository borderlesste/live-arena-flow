const LOCAL_API_ORIGIN = "http://127.0.0.1:8787";

class ApiProxyConfigurationError extends Error {}

function resolveApiOrigin() {
  const configuredOrigin = process.env.API_INTERNAL_URL?.trim();
  if (!configuredOrigin) {
    if (process.env.NODE_ENV !== "production") return new URL(LOCAL_API_ORIGIN);
    throw new ApiProxyConfigurationError("API_INTERNAL_URL is not configured");
  }

  const origin = new URL(configuredOrigin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) {
    throw new ApiProxyConfigurationError("API_INTERNAL_URL is invalid");
  }
  return origin;
}

function errorResponse(status: 502 | 503, code: string, requestId: string) {
  return Response.json(
    { error: "API temporalmente no disponible", code, requestId },
    { status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}

async function proxy(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const incomingUrl = new URL(request.url);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  let apiOrigin: URL;

  try {
    apiOrigin = resolveApiOrigin();
    if (apiOrigin.origin === incomingUrl.origin) {
      throw new ApiProxyConfigurationError("API_INTERNAL_URL cannot point to the frontend origin");
    }
  } catch (error) {
    console.error("[api-proxy] configuration error", {
      requestId,
      method: request.method,
      path: incomingUrl.pathname,
      error: error instanceof ApiProxyConfigurationError ? error.message : "Invalid proxy configuration",
    });
    return errorResponse(503, "API_UPSTREAM_NOT_CONFIGURED", requestId);
  }

  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, apiOrigin);
  target.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("x-request-id", requestId);

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch (error) {
    console.error("[api-proxy] upstream unavailable", {
      requestId,
      method: request.method,
      path: incomingUrl.pathname,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(502, "API_UPSTREAM_UNAVAILABLE", requestId);
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
