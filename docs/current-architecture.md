# Current Architecture

## Inventory Map

Frontend: Next.js 15 app shell serving the existing React 18 SPA through `src/app/[[...slug]]/page.tsx` and `src/app/client-app.tsx`.

Backend: Local Node HTTP server in `server/index.ts`, intended for Render or another persistent Node host. Next rewrites `/api/*` to this service through `API_INTERNAL_URL`.

Base de datos: Supabase PostgreSQL is modeled through versioned SQL migrations in `supabase/migrations`. Local development still has a JSON fallback at `server/data/app.json`.

Autenticacion: Supabase Auth when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured. Legacy JSON auth is development-only and disabled in production.

Realtime: Supabase Realtime for chat and presence. Realtime publication migration exists for `chat_messages` and `chat_rooms`.

Storage: No Supabase Storage bucket or Cloudflare R2 integration is implemented in this checkout.

API deportiva: SportSRC V2 remains the external provider. The backend normalizes and synchronizes its football events into the Supabase sports catalog, which also accepts local matches created by administrators. Public IDs remain stable so existing routes, favorites and live sources continue working.

Hosting frontend: Vercel-compatible Next.js build. No `vercel.json` is present.

Hosting backend: Render-compatible persistent Node service by convention. No `render.yaml` is present.

DNS/CDN/WAF: Cloudflare variables are present, but no Worker, Pages, R2, WAF or cache rule config is committed.

Repositorio y CI/CD: GitHub remote exists and `.github/workflows/ci.yml` now validates lint, typecheck, tests, E2E and build.

Workers: None committed.

Cron jobs: None committed.

Webhooks: None committed.

Streaming: Admin-managed video sources and OBS ingest metadata. Public responses strip OBS secrets; stream keys are encrypted when `STREAM_SECRET_KEY` is configured.

## Service Matrix

| Servicio | Configurado | Referenciado | Usado realmente | Produccion | Funcion |
| --- | ---: | ---: | ---: | ---: | --- |
| GitHub | Si | Si | Si | Si | Source control and CI |
| Vercel | Parcial | Si | No verificable localmente | Probable frontend | Next.js frontend and API rewrites |
| Render | Parcial | Si | No verificable localmente | Probable backend | Persistent Node API |
| Cloudflare | Parcial | Si | No | Futuro/manual | DNS/WAF/CDN, not committed |
| Supabase | Si | Si | Si cuando env existe | Si | Auth, PostgreSQL, RLS, Realtime |
| SportSRC V2 | Si | Si | Si con licencia | Si | Proveedor externo sincronizado al catálogo |
| Catálogo deportivo Supabase | Si | Si | Si con service role | Si | Fuente canónica para eventos SportSRC y locales |

## Main Risks

- `server/index.ts` remains too large and mixes routing, validation, persistence, Supabase access and response shaping.
- Some mutable app data still lives in `server/data/app.json`, which is not safe for multi-replica production.
- No committed Render/Vercel deployment manifests exist, so deployment settings must be verified in dashboards.
- Cloudflare is only represented by environment variables; rules are not codified.
