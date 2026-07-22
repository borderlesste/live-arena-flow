# Deployment

Before publishing to `main`, run `npm run release:gate`. This is the same release gate used by GitHub CI and covers the Vercel failures previously seen in production: Node 24 runtime parity, production dependency audit, lint, app/server typecheck, unit/integration tests, `next build` and smoke E2E.

Deploy the Next.js frontend to Vercel with `npm run build`. Configure `NEXT_PUBLIC_*` only with browser-safe values. In Vercel Production, set `API_INTERNAL_URL=https://live-arena-flow.onrender.com`, without the `/api` suffix. `localhost` and `127.0.0.1` are invalid because each Vercel Function runs in an isolated environment without the backend process.

Deploy `server/index.ts` to Render as the API service. Configure Supabase, `SPORTSRC_API_KEY` and stream encryption secrets only in Render. Never expose service-role keys, provider keys, ingest URLs or stream keys through `NEXT_PUBLIC_*` variables.

Use `/api/health` as the health check. It returns non-secret status for database/auth configuration, SportSRC and version. Startup requires `SPORTSRC_API_KEY` in every environment.

After changing either platform's variables, redeploy Render first and verify its direct `/api/health` endpoint. Then redeploy Vercel and verify `https://luisromerofutbol.com/api/health`. A `503 API_UPSTREAM_NOT_CONFIGURED` means `API_INTERNAL_URL` is missing or invalid; a `502 API_UPSTREAM_UNAVAILABLE` means the configured backend cannot be reached.

Cloudflare should proxy DNS, preserve Supabase Realtime WebSockets, cache only explicitly public GET responses, and never cache `/admin`, authenticated responses or session traffic.
