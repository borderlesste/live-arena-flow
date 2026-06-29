# Plan de implementación

Estado a 2026-06-28: estabilización prioritaria implementada; lint, tipos, 168 pruebas unitarias, 32 E2E y build pasan localmente. Una E2E permanece omitida porque requiere Supabase real.

## Ahora

- Seguridad Supabase/RLS, contratos de streaming y saneamiento de secretos.
- Flujo OBS/Cloudflare: creación idempotente, reveal, enable/disable, sustitución, eliminación y webhook.
- Lint, typecheck, pruebas unitarias, migraciones, E2E y build limpio.

## Después

- Worker de reconciliación y limpieza de recursos externos.
- Modularización de dominios restantes del servidor.
- Storage, jobs, agregaciones analíticas, observabilidad y paneles adicionales.

## Aceptación

La iteración exige `lint`, `typecheck`, `test`, `test:e2e` y `build` en verde. Supabase, Cloudflare y OBS solo se consideran validados después de ejecutar las pruebas manuales con credenciales reales; los mocks de CI no sustituyen esa evidencia.

Orden de despliegue: migración → API/frontend → secreto nuevo → webhook → prueba OBS.
