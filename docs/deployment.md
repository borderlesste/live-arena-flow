# Deployment

Deploy the Next.js frontend to Vercel with `npm run build`. Configure `NEXT_PUBLIC_*` only with browser-safe values. Set `API_INTERNAL_URL` to the Render API origin used by the Next.js `/api` rewrite.

Deploy `server/index.ts` to Render as the API service. Configure Supabase, `SPORTSRC_API_KEY` and stream encryption secrets only in Render. Never expose service-role keys, provider keys, ingest URLs or stream keys through `NEXT_PUBLIC_*` variables.

Use `/api/health` as the health check. It returns non-secret status for database/auth configuration, SportSRC and version. Startup requires `SPORTSRC_API_KEY` in every environment.

Cloudflare should proxy DNS, preserve Supabase Realtime WebSockets, cache only explicitly public GET responses, and never cache `/admin`, authenticated responses or session traffic.
