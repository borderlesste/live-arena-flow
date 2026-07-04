# Roadmap maestro verificable

Última revisión: 2026-06-28.

## Objetivo actual

Estabilizar la plataforma existente antes de ampliar producto. Una fase solo se marca como validada cuando sus criterios automáticos pasan y, cuando depende de servicios externos, existe evidencia manual del entorno real.

## Estado comprobado antes de esta iteración

- TypeScript y 177 pruebas unitarias pasaban.
- ESLint fallaba con 27 errores y 9 avisos.
- Next compilaba en un directorio aislado; un `.next` inconsistente en OneDrive rompía el paso final.
- La integración Cloudflare/OBS tenía contratos incompletos y seis hallazgos de seguridad validados.
- Supabase, Cloudflare y OBS reales no estaban disponibles para validación manual.

## P0 — Seguridad y streaming

Estado: implementado en el checkout; pendiente de gates finales y despliegue.

- [x] Migración forward-only con privilegios mínimos para perfiles, chat, métricas y `live_sources`.
- [x] RPC separadas para borrado propio y moderación de chat.
- [x] Cola durable de limpieza de Live Inputs y RPC transaccionales para sustitución/webhooks.
- [x] Secreto de webhook retirado de `.env.example`; debe rotarse en el proveedor.
- [x] Payload oficial Cloudflare: `data.input_id`, `data.event_type`, `data.updated_at`.
- [x] Creación con `{ source, credentials?, replayed }`; no reexpone claves en replay idempotente.
- [x] Custom RTMP falla cerrado sin playback HTTPS independiente.
- [x] Enable/disable Cloudflare mediante `PUT { enabled }`.
- [x] Rotación Cloudflare por sustitución segura y limpieza reintentable.
- [x] Eliminación con `deletion_pending` y `deletion_failed`.
- [ ] Aplicar migración en Supabase de staging/producción.
- [ ] Rotar y configurar el secreto real del webhook.
- [ ] Validar creación, emisión OBS y HLS con Cloudflare real.

## P1 — Calidad de entrega

Estado: validado localmente el 2026-06-28.

- [x] `npm run lint` sin errores (9 avisos de optimización de imágenes).
- [x] `npm run typecheck`.
- [x] `npm run test`: 168/168.
- [x] `npm run test:e2e`: 32 aprobadas, 1 omitida por requerir Supabase real.
- [x] `npm run build` desde `.next` limpio.
- [x] Auditoría de dependencias documentada en `docs/security.md`.

## P2 — Arquitectura incremental

Estado: pendiente; no bloquea P0/P1.

- Extraer dominios restantes del monolito `server/index.ts`.
- Añadir worker que reclame la cola con `FOR UPDATE SKIP LOCKED`.
- Completar telemetría, agregaciones y retención analítica.
- Provisionar Storage, jobs y observabilidad operativa.
- Completar paneles administrativos todavía no implementados.

## Dependencias externas

- Supabase: proyecto, service role, migraciones, Auth/Realtime.
- Cloudflare Stream: Account ID, token `Stream Write`, customer code y Notifications.
- OBS: operador y señal de prueba.
- Despliegue coordinado de frontend y API por el nuevo contrato.

## Orden de despliegue

1. Aplicar la migración compatible.
2. Desplegar API y frontend juntos.
3. Rotar el secreto expuesto y configurar el valor nuevo.
4. Activar el webhook de Cloudflare.
5. Ejecutar la prueba manual Cloudflare → OBS → HLS.

No declarar producción validada hasta completar los cinco pasos y adjuntar evidencia.
