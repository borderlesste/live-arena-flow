# Refactoring Report

Date: 2026-06-24

## Executive Summary

The project is a hybrid Next.js frontend plus persistent Node API with Supabase as the production data/auth/realtime target and JSON files as local fallback. The sports data boundary is already abstracted behind providers, but deployment manifests and production diagnostics were incomplete.

This pass added CI, safer health diagnostics, production sports-provider validation, centralized public frontend env parsing, a fuller migration test and architecture documentation. No visual redesign was made.

## Architecture Found

- Frontend: Next.js 15 serving React 18 SPA components.
- Backend: Node HTTP API in `server/index.ts`.
- DB/Auth/Realtime: Supabase migrations, Auth and Realtime are present.
- Sports API: SportSRC V2 behind the normalized `SportsProvider` contract.
- Streaming: Admin-managed video sources plus OBS ingest metadata; public responses strip secrets.
- Deployment: Vercel/Render split is intended but not codified through `vercel.json` or `render.yaml`.

## Findings

### F-001

ID: F-001
Severidad: Media
Archivo: `.env.example`
Problema: OAuth and provider variable names were incomplete or mismatched with the active code/configuration.
Impacto: New environments can be configured with unused names and miss required live/provider values.
Correccion: Added the required authentication and integration variables; SportSRC now only requires `SPORTSRC_API_KEY`.
Validacion: `npm run typecheck`, `npm run lint`.
Estado: Corregido.

### F-002

ID: F-002
Severidad: Alta
Archivo: `server/modules/sports/index.ts`
Problema: Production could start without the required SportSRC license.
Impacto: Fragile startup and unreliable quota/live coverage.
Correccion: Startup now fails clearly unless `SPORTSRC_API_KEY` is configured.
Validacion: Typecheck and unit tests.
Estado: Corregido.

### F-003

ID: F-003
Severidad: Media
Archivo: `server/index.ts`
Problema: `/api/health` only returned a minimal static payload and did not report safe configuration status.
Impacto: Render/Vercel/ops cannot distinguish app liveness from missing provider/auth configuration.
Correccion: Health payload now includes non-secret version, database/auth status and sports provider configuration status.
Validacion: `npm run typecheck`; runtime probe on `http://127.0.0.1:18888/api/health`.
Estado: Corregido.

### F-004

ID: F-004
Severidad: Media
Archivo: `server/index.ts`
Problema: Contact submission logging included raw email addresses.
Impacto: PII can be retained in platform logs.
Correccion: Log message no longer includes email.
Validacion: Typecheck.
Estado: Corregido.

### F-005

ID: F-005
Severidad: Media
Archivo: `server/db/migrations.test.ts`
Problema: Migration test claimed complete coverage but executed only a subset of SQL migrations.
Impacto: Schema drift in later migrations could ship unnoticed.
Correccion: Test now reads and executes all versioned migration SQL files in order.
Validacion: `npm test` passed with all migration SQL files executed in order.
Estado: Corregido.

### F-006

ID: F-006
Severidad: Baja
Archivo: `src/services/*`
Problema: Public API base URL parsing was duplicated across services.
Impacto: Config drift and harder environment validation.
Correccion: Added `src/config/env.ts` and moved services to `publicEnv.NEXT_PUBLIC_API_BASE_URL`.
Validacion: Typecheck and lint.
Estado: Corregido.

### F-007

ID: F-007
Severidad: Media
Archivo: `server/index.ts`
Problema: API routing, validation, Supabase access, metrics, legacy auth and persistence remain concentrated in one large file.
Impacto: Maintenance and security review are harder.
Correccion: Documented as next refactor target; not split in this pass to avoid broad behavioral risk.
Validacion: N/A.
Estado: Pendiente.

### F-008

ID: F-008
Severidad: Media
Archivo: `server/data/app.json`
Problema: Mutable production-like data still has a JSON fallback.
Impacto: Not safe for multi-instance production and can drift from Supabase model.
Correccion: Documented migration target; keep fallback for local development only.
Validacion: N/A.
Estado: Pendiente.

### F-009

ID: F-009
Severidad: Media
Archivo: `package-lock.json`
Problema: `npm audit --omit=dev` reports a moderate PostCSS advisory through Next.js' bundled dependency.
Impacto: Dependency audit remains non-clean even though the suggested automatic fix would downgrade Next.js to an incompatible major version.
Correccion: Not auto-applied; `npm audit fix --force` is unsafe here because it would install `next@9.3.3`.
Validacion: `npm audit --omit=dev`.
Estado: Pendiente.

## Files Refactored

- `.env.example`
- `.github/workflows/ci.yml`
- `server/index.ts`
- `server/modules/sports/index.ts`
- `server/db/migrations.test.ts`
- `src/config/env.ts`
- `src/app/layout.tsx`
- `src/lib/supabase.ts`
- `src/services/*.service.ts`
- `docs/current-architecture.md`
- `docs/target-architecture.md`
- `docs/infrastructure.md`
- `docs/environment-variables.md`
- `docs/sports-providers.md`
- `docs/testing.md`
- `docs/refactoring-report.md`

## Modules Created

- `src/config/env.ts`
- `.github/workflows/ci.yml`

## Dependencies

- Added: none.
- Removed: none.

## Provider State

SportSRC V2 is the only sports provider. Its endpoint and authentication header are fixed in code; every environment requires `SPORTSRC_API_KEY`.

## Validation Results

- `npm run typecheck`: passed.
- `npm run lint`: passed with 9 existing Fast Refresh warnings.
- `npm test`: passed, 12 files and 57 tests.
- `npm run test:e2e -- smoke.spec.ts`: passed, 7 tests.
- `npm run build`: passed with the same Fast Refresh warnings and a stale Browserslist notice.
- Runtime health probe: passed on local API port `18888`; returned non-secret provider/auth/database status.
- `npm audit --omit=dev --audit-level=high`: passed; the CI workflow uses this non-breaking gate.
- `npm audit --omit=dev`: failed on 2 moderate findings from bundled PostCSS through Next.js; force fix is not safe.

## Manual Configuration Pending

- Confirm Vercel project settings and `API_INTERNAL_URL`.
- Confirm Render service, health check path and secrets.
- Confirm Cloudflare DNS/WAF/cache rules in dashboard.
- Confirm Supabase project migrations are applied.
- Confirm that the SportSRC account plan and quota match the production subscription.

## Rollback Notes

- CI can be removed by deleting `.github/workflows/ci.yml`.
- Health payload changes are backward compatible because `ok` and `service` remain present.
- Production sports-provider guard can be rolled back in `server/modules/sports/index.ts`, but doing so reintroduces public-key fallback risk.
