# Luis Romero Fútbol

Aplicación React/Vite con backend Node para datos deportivos, fuentes de vídeo, OBS, contenido, patrocinadores y chat.

Consulta el inventario actual en [`docs/current-architecture.md`](docs/current-architecture.md), la arquitectura objetivo en [`docs/target-architecture.md`](docs/target-architecture.md), variables en [`docs/environment-variables.md`](docs/environment-variables.md) y el reporte de auditoria en [`docs/refactoring-report.md`](docs/refactoring-report.md).

## Desarrollo

1. Duplica `.env.example` como `.env` y cambia `ADMIN_API_TOKEN`.
2. Instala dependencias con `npm install --legacy-peer-deps`.
3. Ejecuta frontend y backend con `npm run dev`.

Frontend: `http://localhost:8080`

Backend: `http://127.0.0.1:8787/api/health`

Las APIs deportivas se consumen exclusivamente desde el backend. `SPORTS_PROVIDER` define la prioridad entre SportsDataIO y TheSportsDB; cuando ambas están configuradas, la secundaria entra automáticamente si la principal falla o no devuelve contenido utilizable. Las claves nunca se incluyen en el bundle del navegador.

## Persistencia

Los datos propios se guardan de forma atómica en `server/data/app.json`, ignorado por Git. El almacenamiento comienza vacío: no se cargan seeds ni datos mock.

Colecciones persistidas:

- `videoSources`: fuentes HLS/HTML5/embed y configuración privada OBS.
- `sponsors`: patrocinadores publicados.
- `news`: noticias editoriales.
- `highlights`: destacados editoriales.
- `chatMessages`: últimos 200 mensajes.

## API

Rutas públicas principales:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET|PATCH /api/profile`
- `GET /api/sports/events?date=YYYY-MM-DD`
- `GET /api/sports/live`
- `GET /api/sports/events/:id`
- `GET /api/video-sources`
- `GET /api/sponsors`
- `GET /api/news`
- `GET /api/highlights`
- `GET|POST /api/chat/messages`

Las escrituras administrativas usan `Authorization: Bearer <ADMIN_API_TOKEN>`:

- `GET|PUT /api/admin/video-sources`
- `DELETE /api/admin/video-sources/:id`
- `PUT|DELETE /api/admin/sponsors/:id`
- `PUT|DELETE /api/admin/news/:id`
- `PUT|DELETE /api/admin/highlights/:id`

## Producción

El adaptador JSON proporciona persistencia real para una instancia. En despliegues con varias réplicas debe sustituirse `server/store.ts` por PostgreSQL u otra base compartida conservando el mismo contrato HTTP.

La implementación actual todavía no equivale a la arquitectura objetivo con Supabase, SportSRC, presencia y analítica agregada. Consulta [`docs/architecture.md`](docs/architecture.md) y los documentos de `docs/` para distinguir capacidades verificadas de bloqueos de producción.

Las migraciones Supabase están en `supabase/migrations`. El frontend activa Supabase Auth al configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; durante `next build`, si faltan esas variables públicas, el proyecto usa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` como fallback seguro para evitar que el navegador caiga al adaptador legacy. En producción la API exige `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `STREAM_SECRET_KEY`.

Con esas variables configuradas, chat, presencia, reportes, favoritos y métricas de patrocinadores usan Supabase/RLS/Realtime. Sin ellas se conserva el fallback JSON únicamente para desarrollo local; las rutas de chat heredadas responden `410` en producción.
