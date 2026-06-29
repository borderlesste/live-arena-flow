# Infrastructure

## GitHub

- Remote: `https://github.com/borderlesste/live-arena-flow.git`
- Branch observed locally: `main`
- CI: `.github/workflows/ci.yml`
- Branch protection: not detectable from local checkout.
- Secrets: not detectable from local checkout.

## Vercel

- Local evidence: `next.config.mjs` rewrites `/api/:path*` to `API_INTERNAL_URL`.
- No `vercel.json` is committed.
- Required dashboard checks: project root, Node 22 support, `npm run build`, public `NEXT_PUBLIC_*` values only, and `API_INTERNAL_URL` pointing to backend.

Do not store these on Vercel:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SPORTSRC_API_KEY`
- `STREAM_SECRET_KEY`
- `ADMIN_API_TOKEN`

## Render

- Local evidence: API starts with `npm run server` and listens on `API_PORT`.
- No `render.yaml` is committed.
- Expected build: `npm ci`
- Expected start: `npm run server`
- Health check: `/api/health`

## Cloudflare

- Local evidence: Cloudflare variable names exist in `.env`, but no Worker or Pages config is committed.
- Recommended role: DNS, WAF, DDoS, rate limits and public cache rules.
- Never cache: `/api/auth/*`, `/api/profile`, `/api/admin/*`, `/api/chat/*`, Supabase Realtime, OAuth callbacks, or personalized responses.

## Supabase

- Migrations exist in `supabase/migrations`.
- RLS is enabled for the sensitive tables covered by tests.
- Realtime publication is configured for chat tables.
- Storage buckets are not represented in migrations.

## SportSRC V2

- The backend requires `SPORTSRC_API_KEY` in every environment.
- The API endpoint is fixed to `https://api.sportsrc.org/v2/` and authentication uses `X-API-KEY`.
- No sports API key is exposed through Vercel or `NEXT_PUBLIC_*`.
