# Environment Variables

This document lists names and responsibilities only. Do not commit real values.

## Public Frontend

| Variable | Required | Notes |
| --- | ---: | --- |
| `NEXT_PUBLIC_APP_URL` | Required in production | Canonical HTTPS origin used for metadata and authentication links. For this deployment use `https://www.luisromerofutbol.com`; never configure a loopback URL in Vercel Production. |
| `NEXT_PUBLIC_API_BASE_URL` | Recommended | Defaults to `/api`. |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Operational | `true` wraps public routes in the maintenance page and only lets `super_admin`/`admin` accounts bypass it. Defaults to `true` in this checkout so the next production deploy activates maintenance immediately. Set `false` to reopen the site. |
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Browser-safe project URL. If omitted, Next retrieves it from the backend through `API_INTERNAL_URL`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Recommended | Browser-safe publishable key. If omitted, Next retrieves it from the backend. Accepts modern `sb_publishable_…` and valid public `anon` JWTs. |
| `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Web Analytics | Public site token used by the Cloudflare beacon. It is not an API credential. |

## Vercel Server Runtime

| Variable | Required | Notes |
| --- | ---: | --- |
| `API_INTERNAL_URL` | Production | Public HTTPS origin of the persistent backend, without the `/api` suffix. Never use `localhost` or `127.0.0.1` in Vercel. |
| `CRON_SECRET` | Web Analytics | Random secret used by Vercel Cron and the backend. Configure the same value in both services. Never expose it through `NEXT_PUBLIC_*`. |

## Backend / Render

| Variable | Required | Notes |
| --- | ---: | --- |
| `API_PORT` | Optional | Defaults to `8787`. |
| `APP_ORIGIN` | Required outside local defaults | Exact CORS origin. |
| `SUPABASE_URL` | Production | Server-side Supabase URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Production | Public Supabase key used for token verification, profile repair and as build-time fallback for the browser when `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is omitted. Accepts modern `sb_publishable_…` and legacy public `anon` JWTs that are still valid. |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Admin metrics/features | Server only. |
| `STREAM_SECRET_KEY` | Production | At least 32 characters; encrypts OBS stream keys. |
| `STREAM_PROVIDER` | Streaming | `custom`, `cloudflare`, `restream`, or `restream_cloudflare`. The admin can bypass Restream per new source; use `cloudflare` to make direct OBS ingest the global default. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Server only. |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare | Server-only token with Stream Write. |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Cloudflare playback | Builds the public HLS hostname. |
| `CLOUDFLARE_STREAM_RECORDING_MODE` | Cloudflare playback | Use `automatic` when the Live Input must be viewable through HLS. `off` accepts ingest but does not publish HLS playback. |
| `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` | Cloudflare playback | Comma-separated hostnames allowed to load the stream; do not include schemes or paths. |
| `CLOUDFLARE_STREAM_API_TIMEOUT_MS` | Cloudflare | Backend request timeout, from 1000 to 60000 ms. |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | Cloudflare production | At least 32 characters; rotate the previously exposed value. |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | Web Analytics | Dedicated server-only token with `Account Analytics: Read`. Do not reuse the Stream token. |
| `CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN` | Web Analytics | Server-side alias of the public site token; optional when the public token is also present in the backend environment. |
| `CLOUDFLARE_ANALYTICS_API_TIMEOUT_MS` | Web Analytics | Cloudflare GraphQL timeout. Defaults to 15000 ms. |
| `CRON_SECRET` | Web Analytics | Must match Vercel's value; authorizes only the internal analytics synchronization route. |
| `RESTREAM_ACCESS_TOKEN` | Restream API mode | Server-only OAuth access token with `channels.read` and `stream.read`. |
| `RESTREAM_INGEST_URL` | Restream static mode | RTMP/RTMPS/SRT ingest URL; requires `RESTREAM_STREAM_KEY`. |
| `RESTREAM_STREAM_KEY` | Restream static mode | Server-only publishing key; never expose through `NEXT_PUBLIC_*`. |
| `RESTREAM_API_TIMEOUT_MS` | Restream | Backend timeout from 1000 to 60000 ms. |
| `ADMIN_API_TOKEN` | Dev/test only | Disabled as a production admin shortcut. |
| `LEGACY_AUTH_ENABLED` | Dev only | Must stay false in production. |

## SportSRC V2

| Variable | Required | Notes |
| --- | ---: | --- |
| `SPORTSRC_API_KEY` | Required | SportSRC V2 license key. Server only; sent through `X-API-KEY`. |

## Compatibility Variables

| Variable | Status | Notes |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Compatibility alias | Prefer `CLOUDFLARE_STREAM_API_TOKEN`; never expose either token. |

## Validation Rules

- Every environment must configure `SPORTSRC_API_KEY`.
- Production must configure Supabase auth variables.
- Production must configure `STREAM_SECRET_KEY` with at least 32 characters.
- Cloudflare production must configure a webhook secret with at least 32 characters.
- Cloudflare HLS playback requires `CLOUDFLARE_STREAM_RECORDING_MODE=automatic`.
- Frontend variables must never contain service-role, provider, ingest, or admin secrets.
- The Cloudflare analytics API token must be separate from the public site token and the Stream write token.
