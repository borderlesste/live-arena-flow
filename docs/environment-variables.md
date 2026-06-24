# Environment Variables

This document lists names and responsibilities only. Do not commit real values.

## Public Frontend

| Variable | Required | Notes |
| --- | ---: | --- |
| `NEXT_PUBLIC_APP_URL` | Recommended | Used for metadata and public links. |
| `NEXT_PUBLIC_API_BASE_URL` | Recommended | Defaults to `/api`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for Supabase auth | Browser-safe project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for Supabase auth | Browser-safe anon key only. |

## Backend / Render

| Variable | Required | Notes |
| --- | ---: | --- |
| `API_PORT` | Optional | Defaults to `8787`. |
| `APP_ORIGIN` | Required outside local defaults | Exact CORS origin. |
| `API_INTERNAL_URL` | Required by Next/Vercel | Backend origin for rewrites. |
| `SUPABASE_URL` | Production | Server-side Supabase URL. |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Production | Token verification and user profile repair. |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Admin metrics/features | Server only. |
| `STREAM_SECRET_KEY` | Production | At least 32 characters; encrypts OBS stream keys. |
| `ADMIN_API_TOKEN` | Dev/test only | Disabled as a production admin shortcut. |
| `LEGACY_AUTH_ENABLED` | Dev only | Must stay false in production. |

## Sports Providers

| Variable | Required | Notes |
| --- | ---: | --- |
| `SPORTS_PROVIDER` | Optional | `sportsdataio`, `sportsrc`, or `thesportsdb`. |
| `SPORTSRC_BASE_URL` | If SportsDataIO enabled | Example shape: provider API base URL. |
| `SPORTSRC_API_KEY` | If SportsDataIO enabled | Server only. |
| `SPORTSRC_EVENTS_PATH` | Optional | Defaults to `GamesByDate/{date}`. |
| `SPORTSRC_EVENT_PATH` | Optional | Defaults to `Game/{id}`. |
| `SPORTSRC_LIVE_EVENTS_PATH` | Optional | Used when the provider exposes a dedicated live endpoint. |
| `SPORTSRC_AUTH_HEADER` | Optional | Defaults to `Ocp-Apim-Subscription-Key`. |
| `THESPORTSDB_API_KEY` | Production fallback or primary | Server only. |

## Third-party Platform Variables

| Variable | Status | Notes |
| --- | --- | --- |
| `AUTH_GOOGLE_CLIENT_ID` | Referenced by configuration intent | Configure in Supabase Auth/dashboard as needed. |
| `AUTH_GOOGLE_CLIENT_SECRET` | Secret | Server/dashboard only. |
| `CLOUDFLARE_ACCOUNT_ID` | Future/manual | No committed Cloudflare integration currently consumes it. |
| `CLOUDFLARE_API_TOKEN` | Future/manual | Do not expose to frontend. |
| `RESEND_API_KEY` | Future/manual | Contact form currently persists locally; no email send integration is wired. |

## Validation Rules

- Production must configure at least one sports provider without relying on TheSportsDB public dev key.
- Production must configure Supabase auth variables.
- Production must configure `STREAM_SECRET_KEY` with at least 32 characters.
- Frontend variables must never contain service-role, provider, ingest, or admin secrets.
