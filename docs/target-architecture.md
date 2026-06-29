# Target Architecture

## Recommended Distribution

GitHub owns source control, pull requests and CI.

Vercel owns the public Next.js frontend. It should not hold service-role keys, sports API keys, ingest secrets or long-running backend duties.

Render owns the persistent Node API until the backend is either migrated to Supabase Edge Functions/Workers or made serverless-compatible. It should hold provider keys, Supabase service role, stream encryption and admin-only integrations.

Supabase owns PostgreSQL, Auth, RLS, Realtime and future Storage. Production data should move out of `server/data/app.json`.

Cloudflare may own DNS, WAF, rate limiting and public cache rules. It should not duplicate frontend hosting unless the frontend is intentionally moved off Vercel.

SportSRC V2 remains behind the normalized `SportsProvider` contract. The frontend must never consume provider-native shapes.

## Replacement Decisions

| Tecnologia | Responsabilidad | Necesaria | Puede reemplazarse | Reemplazo posible | Decision |
| --- | --- | ---: | ---: | --- | --- |
| GitHub | Repo and CI | Si | No | N/A | Conservar |
| Vercel | Frontend Next.js | Si, si se usa dashboard | Parcial | Render static/web or Cloudflare Pages | Conservar si ya esta conectado |
| Render | Persistent API | Si mientras haya Node server | Parcial | Vercel Functions or Cloudflare Workers only after API is simplified | Conservar |
| Cloudflare | DNS/WAF/CDN | Opcional | Si | Vercel edge protections | Mantener como manual/futuro si aporta WAF |
| Supabase | DB/Auth/Realtime | Si | No sin redisenar | Custom Postgres/Auth stack | Conservar |
| SportSRC V2 | Sports data | Si | Si | Provider migration | Unico proveedor activo |

## Refactoring Direction

Keep the current UI surface and move incrementally:

1. Extract `server/index.ts` routes into domain modules: auth, sports, streams, sponsors, analytics, chat, content.
2. Create repository interfaces for JSON fallback and Supabase production persistence.
3. Centralize server environment validation and diagnostics.
4. Move editable app data from JSON to Supabase tables before multi-instance deployment.
5. Add provider health and quota diagnostics for sports APIs.
