# Subplan operativo OBS y Cloudflare Stream

Última revisión: 2026-06-28.

## Flujo implementado

1. El administrador crea una fuente con una clave idempotente UUID.
2. El backend reserva el registro `provisioning` y llama a Cloudflare.
3. La respuesta se valida con Zod y se persiste como `waiting_signal`.
4. El frontend recibe `{ source, credentials, replayed: false }` y muestra la clave una vez.
5. Un replay devuelve `{ source, replayed: true }` sin credenciales; Revelar consulta al proveedor.
6. El endpoint público solo proyecta fuentes activas con playback seguro.

## Operaciones

- Activar/desactivar: `PUT` al Live Input con `{ enabled: true|false }`; persistencia local posterior al éxito externo.
- Rotar: crear Live Input nuevo, sustituir UID/HLS de forma transaccional, encolar el UID anterior e intentar borrarlo.
- Eliminar: marcar `deletion_pending`, borrar en Cloudflare y soft-delete local; si falla, conservar la fuente como `deletion_failed` y encolar limpieza.
- Webhook: autenticar `cf-webhook-auth`, validar payload oficial y ejecutar RPC atómica insert-first para deduplicación.
- Polling: respaldo agrupado mientras el panel está visible.

## Proveedor custom

- Nunca se construye playback desde la stream key.
- La creación devuelve ingestión y clave, pero no URL pública.
- La fuente queda fuera de la API pública hasta guardar una URL HTTPS independiente.
- La validación rechaza una ruta que contenga la clave de publicación.

## Estados canónicos

`provisioning`, `waiting_signal`, `ready`, `live`, `reconnecting`, `disconnected`, `disabled`, `provider_error`, `deletion_pending`, `deletion_failed`.

## Verificación automática requerida

- Contrato de creación y replay sin secreto.
- Custom RTMP sin URL derivada.
- `enabled` de Cloudflare.
- Sustitución y compensación.
- Payload y deduplicación de webhook.
- Migraciones y privilegios RLS/ACL.
- E2E de creación, reveal, toggle, rotación, eliminación y permisos.
- Lint, tipos, unitarias, E2E y build.

## Validación manual pendiente

- Aplicar migración en Supabase.
- Rotar `CLOUDFLARE_STREAM_WEBHOOK_SECRET` y configurar Notifications.
- Crear, desactivar, activar, sustituir y eliminar un Live Input real.
- Emitir desde OBS y reproducir el manifiesto HLS público.

Referencias: [Live Inputs API](https://developers.cloudflare.com/api/resources/stream/subresources/live_inputs/) y [Stream Live Webhooks](https://developers.cloudflare.com/stream/stream-live/webhooks/).
