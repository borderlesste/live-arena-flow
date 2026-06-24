# PROMPT MAESTRO — DESARROLLO COMPLETO DE ARENA LIVE SPORTS

Actúa como arquitecto de software, desarrollador full stack senior, especialista en streaming multimedia, bases de datos, DevOps, seguridad y QA.

Debes analizar, diseñar, implementar, probar y documentar una plataforma deportiva de producción llamada:

# Arena Live Sports

No debes crear una demo, prototipo visual, mockup incompleto ni funcionalidades simuladas. La implementación debe ser funcional, mantenible, segura, escalable y preparada para producción.

Antes de modificar el proyecto:

1. Analiza la arquitectura, dependencias, rutas, componentes, modelos de datos y configuración existentes.
2. Conserva lo que ya funciona.
3. Evita duplicar lógica.
4. No reemplaces módulos funcionales sin una justificación técnica.
5. Documenta los cambios importantes.
6. No expongas claves, secretos, tokens ni credenciales en frontend, repositorio o logs.
7. Ejecuta pruebas, lint, typecheck y build antes de finalizar.

---

# 1. STACK Y ARQUITECTURA

Utiliza la siguiente arquitectura:

## Frontend

* Next.js.
* React.
* TypeScript estricto.
* Tailwind CSS.
* Diseño responsive.
* GSAP para animaciones.
* Lenis para desplazamiento suave.
* Componentes reutilizables.
* Accesibilidad básica WCAG.
* SEO para páginas públicas.
* Vercel como plataforma de despliegue del frontend.

## Backend

* Node.js con TypeScript.
* Render para API, workers y tareas programadas.
* Arquitectura modular por dominios.
* Servicios separados para:

  * Autenticación.
  * Partidos.
  * Transmisiones.
  * Reproductor.
  * Patrocinadores.
  * Usuarios.
  * Analítica.
  * SportSRC.
  * Administración.
  * Auditoría.
* Validación estricta de entradas con Zod o equivalente.
* Manejo centralizado de errores.
* Rate limiting.
* Logging estructurado.
* Variables de entorno validadas.

## Base de datos y servicios

Usar Supabase para:

* PostgreSQL.
* Autenticación.
* Login con Google.
* Registro con correo y contraseña.
* Recuperación de contraseña.
* Confirmación de correo.
* Realtime.
* Chat en vivo.
* Presencia de usuarios.
* Storage para imágenes, videos y archivos autorizados.
* Row Level Security.

## Infraestructura y seguridad perimetral

Usar Cloudflare para:

* DNS.
* CDN.
* WAF.
* Protección DDoS.
* Rate limiting.
* Mitigación de bots.
* Caché de endpoints públicos.
* Reglas de seguridad.
* Protección de endpoints administrativos.

## Datos deportivos

Integrar SportSRC mediante el backend.

Nunca llamar SportSRC directamente desde el navegador.

Crear una capa de abstracción:

```text
SportsProvider
├── SportsrcProvider
└── FutureProvider
```

El frontend no debe depender directamente del formato de SportSRC.

Aplicar:

* Caché.
* Normalización.
* Reintentos controlados.
* Timeouts.
* Circuit breaker.
* Manejo de cuotas.
* Registro de errores.
* Sincronización programada.
* Soporte futuro para sustituir SportSRC.

---

# 2. ROLES Y AUTORIZACIÓN

Implementar los siguientes roles:

* `super_admin`
* `admin`
* `moderator`
* `user`

## Permisos

### Super administrador

* Acceso completo.
* Gestionar administradores.
* Gestionar configuraciones globales.
* Consultar auditoría.
* Gestionar reproductor.
* Gestionar transmisiones.
* Gestionar patrocinadores.
* Gestionar usuarios y roles.
* Consultar analítica completa.

### Administrador

* Gestionar transmisiones.
* Gestionar partidos.
* Gestionar contenido del reproductor.
* Gestionar patrocinadores.
* Moderar chat.
* Consultar métricas.
* Administrar contenido público.

### Moderador

* Moderar chat.
* Silenciar usuarios.
* Bloquear usuarios.
* Eliminar mensajes.
* Consultar reportes.

### Usuario

* Ver transmisiones públicas autorizadas.
* Participar en chat.
* Guardar favoritos.
* Gestionar perfil.
* Recibir notificaciones según preferencias.

Toda autorización debe validarse en servidor. No basta con ocultar elementos en el frontend.

---

# 3. AUTENTICACIÓN

Implementar autenticación real mediante Supabase Auth.

## Métodos obligatorios

* Registro normal con correo y contraseña.
* Inicio de sesión con correo y contraseña.
* Inicio de sesión con Google.
* Confirmación de correo.
* Recuperación de contraseña.
* Cambio de contraseña.
* Cierre de sesión.
* Renovación segura de sesión.
* Protección de rutas.
* Persistencia de sesión.
* Manejo de sesiones vencidas.
* Redirección segura después del login.

## Perfil de usuario

Guardar:

* ID.
* Nombre.
* Apellido.
* Nombre visible.
* Avatar.
* Correo.
* Rol.
* Estado de cuenta.
* Fecha de creación.
* Último acceso.
* Última actividad.
* Proveedor de autenticación.
* Preferencias.
* Zona horaria.
* Idioma.

## Seguridad

* No almacenar contraseñas manualmente.
* Evitar enumeración de usuarios.
* Sanitizar redirecciones.
* Evitar open redirects.
* Aplicar protección contra abuso.
* Registrar eventos sensibles.
* Implementar RLS correctamente.
* No confiar en roles enviados por el cliente.

---

# 4. REPRODUCTOR MULTIMEDIA PRINCIPAL

El reproductor es el elemento principal de la página de inicio y debe manejarse desde el panel de administración.

Debe ser una implementación de producción, no un iframe fijo ni un reproductor básico.

## Formatos y fuentes obligatorias

Soportar:

* YouTube.
* YouTube Live.
* URL embed.
* Iframe autorizado.
* `.mp4`.
* `.mp3`.
* `.m3u8` HLS.
* Transmisión proveniente de OBS.
* Streams HLS propios.
* URLs externas autorizadas.
* Archivos alojados en Supabase Storage u otro almacenamiento configurado.

Corregir cualquier referencia incorrecta a `3mu8`; el formato correcto es `.m3u8`.

## Compatibilidad con OBS

OBS no se conecta directamente a un reproductor web. Implementar la arquitectura correcta:

```text
OBS
  ↓ RTMP / SRT
Servidor o proveedor de ingestión
  ↓ transcodificación
HLS .m3u8
  ↓
Reproductor web
```

Preparar configuración para proveedores compatibles con RTMP/HLS, por ejemplo mediante variables de entorno y adaptadores.

No exponer stream keys en el frontend.

El panel debe permitir registrar:

* Proveedor de ingestión.
* Servidor RTMP.
* Stream key cifrada o protegida.
* Playback URL.
* URL HLS.
* Estado de conexión.
* Estado del stream.
* Fecha de última señal.
* Inicio programado.
* Finalización programada.

## Tipos de fuente

Crear un modelo normalizado:

```ts
type MediaSourceType =
  | "youtube"
  | "youtube_live"
  | "embed"
  | "iframe"
  | "mp4"
  | "mp3"
  | "hls"
  | "obs_hls";
```

## Funciones obligatorias del reproductor

Implementar:

* Reproducir.
* Pausar.
* Control de volumen.
* Silenciar y activar sonido.
* Pantalla completa.
* Picture-in-Picture cuando sea compatible.
* Selector de calidad.
* Calidad automática.
* Reproducción HLS adaptativa.
* Indicador `EN VIVO`.
* Botón “Volver al directo”.
* Barra de progreso para contenido bajo demanda.
* Tiempo transcurrido.
* Duración.
* Controles accesibles por teclado.
* Soporte táctil.
* Autoocultado de controles.
* Modo cine.
* Responsive para móvil, tablet, escritorio y Smart TV web.
* Estado de buffering.
* Skeleton o loader.
* Manejo de errores.
* Reintentos controlados.
* Detección de stream offline.
* Placeholder cuando no exista transmisión.
* Mensaje programado para próxima transmisión.
* Poster o portada.
* Título del evento.
* Equipos.
* Competición.
* Fecha.
* Hora.
* Marcador.
* Estado del partido.
* Número de espectadores activos.
* Compartir evento.
* Copiar enlace.
* Reportar problema.
* Control de autoplay respetando restricciones del navegador.
* Audio independiente para `.mp3`.
* Reconexión automática en streams HLS.
* Recuperación de errores de red y errores de medios.
* Limpieza correcta del reproductor al cambiar de fuente.
* Prevención de múltiples instancias.
* Telemetría de reproducción.
* Métricas de errores.
* Métricas de buffering.
* Tiempo total reproducido.
* Inicio y abandono de sesión.
* No contar automáticamente como espectador a quien solo abrió la página sin iniciar reproducción.

## Tecnología del reproductor

Para HLS:

* Usar HLS.js cuando el navegador no tenga soporte HLS nativo.
* Usar soporte nativo cuando esté disponible.
* Destruir correctamente la instancia HLS al desmontar el componente.
* Validar URLs antes de cargarlas.
* Implementar timeout y manejo de errores.

Para YouTube:

* Usar la API oficial del reproductor.
* No intentar ocultar elementos obligatorios mediante técnicas prohibidas.
* Sincronizar eventos de play, pause y error con la telemetría interna.

Para embeds:

* Usar una lista de dominios autorizados.
* No permitir HTML arbitrario sin validación.
* No guardar scripts inyectables.
* Aplicar sandbox al iframe cuando el proveedor sea compatible.
* Configurar `allow`, `referrerPolicy` y permisos mínimos.
* Prevenir XSS.

## Selección de transmisión principal

El administrador debe poder:

* Crear una transmisión.
* Editarla.
* Duplicarla.
* Programarla.
* Publicarla.
* Despublicarla.
* Activarla como transmisión principal.
* Cambiar la transmisión principal sin desplegar código.
* Previsualizar antes de publicar.
* Verificar la fuente.
* Probar reproducción.
* Configurar inicio y fin.
* Asociarla con un partido.
* Asociarla con una competición.
* Asociarla con patrocinadores.
* Configurar visibilidad.
* Configurar restricción por país si aplica.
* Configurar si requiere login.
* Configurar poster.
* Configurar título y descripción.
* Definir prioridad.
* Activar fallback.

Solo puede existir una transmisión principal activa por contexto global, salvo que se implemente un sistema de canales.

## Fallback del reproductor

Permitir fuentes alternativas ordenadas:

```text
Fuente principal
→ Fallback 1
→ Fallback 2
→ Mensaje de indisponibilidad
```

Registrar qué fuente falló y cuál se utilizó.

## Restricción importante

No intentar reproducir directamente una URL RTMP en el navegador.

RTMP debe transformarse a HLS, WebRTC o formato web compatible mediante infraestructura de streaming.

---

# 5. PANEL DE ADMINISTRACIÓN DEL REPRODUCTOR

Crear una sección completa:

```text
/admin/streams
```

## Vista de listado

Mostrar:

* Nombre.
* Tipo de fuente.
* Evento asociado.
* Estado.
* En vivo.
* Programada.
* Finalizada.
* Fuente activa.
* Espectadores.
* Errores recientes.
* Fecha de inicio.
* Fecha de actualización.
* Acciones.

## Formulario

Campos:

* Nombre interno.
* Título público.
* Descripción.
* Tipo de fuente.
* URL de reproducción.
* ID de YouTube.
* Código embed validado.
* URL HLS.
* Archivo multimedia.
* Poster.
* Partido asociado.
* Competición.
* Inicio programado.
* Fin programado.
* Zona horaria.
* Estado.
* Visibilidad.
* Requiere autenticación.
* Permitir chat.
* Permitir Picture-in-Picture.
* Permitir compartir.
* Mostrar contador de espectadores.
* Fuente de fallback.
* Patrocinadores asociados.

## Diagnóstico

Crear un comprobador que valide:

* Sintaxis de URL.
* Protocolo HTTPS.
* Tipo MIME esperado.
* Disponibilidad.
* Respuesta HTTP.
* CORS.
* Manifiesto HLS.
* Segmentos HLS.
* Dominio permitido.
* Estado de YouTube.
* Errores del proveedor.
* Caducidad de URL firmada.
* Fuente no segura.
* Contenido mixto.

No permitir publicar una transmisión inválida sin advertencia explícita y permiso administrativo.

---

# 6. PATROCINADORES Y SLIDER ANIMADO

El slider de patrocinadores mostrado en la página principal debe gestionarse completamente desde el panel de administración.

Crear:

```text
/admin/sponsors
```

## Datos del patrocinador

* Nombre.
* Logo.
* Logo alternativo para fondo oscuro.
* Texto alternativo.
* URL de destino.
* Descripción.
* Tipo.
* Estado.
* Prioridad.
* Fecha de inicio.
* Fecha de finalización.
* Dispositivos habilitados.
* Posición.
* Campaña.
* Evento asociado.
* Transmisión asociada.
* Etiquetas UTM.
* Número máximo de impresiones opcional.
* Número máximo de clics opcional.

## Funciones administrativas

* Crear.
* Editar.
* Eliminar con confirmación.
* Activar.
* Desactivar.
* Programar.
* Reordenar mediante drag and drop.
* Duplicar.
* Previsualizar.
* Asociar con transmisiones.
* Asociar con competiciones.
* Definir patrocinadores globales.
* Definir patrocinadores específicos por evento.
* Consultar impresiones.
* Consultar clics.
* Consultar CTR.
* Exportar métricas.

## Slider frontend

Implementar:

* Animación fluida.
* Loop infinito sin saltos visibles.
* GSAP.
* Pausa al pasar el cursor.
* Pausa cuando la pestaña está oculta.
* Respeto por `prefers-reduced-motion`.
* Lazy loading.
* Imágenes optimizadas.
* Responsive.
* Enlaces seguros.
* `rel="noopener noreferrer sponsored"` cuando corresponda.
* Accesibilidad.
* Navegación por teclado.
* Swipe en dispositivos móviles.
* No causar layout shift.
* No bloquear el hilo principal.
* No duplicar eventos analíticos.

## Métricas

Registrar:

* Impresión visible real.
* Clic.
* Fecha.
* Usuario anónimo o autenticado.
* Campaña.
* Patrocinador.
* Evento.
* Transmisión.
* Dispositivo.
* País aproximado cuando esté permitido.
* UTM.

No registrar una impresión solo porque el elemento exista en el DOM. Utilizar Intersection Observer y un umbral de visibilidad.

---

# 7. USUARIOS ACTIVOS Y ANALÍTICA

Implementar un sistema real para mostrar y analizar usuarios activos.

No usar únicamente el número de sesiones abiertas en Supabase Auth.

## Definiciones

### Usuario online ahora

Usuario con actividad o heartbeat reciente dentro de una ventana configurable, por ejemplo 60–120 segundos.

### Usuario activo diario

Usuario único con una actividad válida durante un día.

### Usuario activo semanal

Usuario único con una actividad válida durante los últimos siete días o semana calendario, según la métrica configurada.

### Usuario activo mensual

Usuario único con actividad durante el mes o los últimos 30 días.

### Usuario activo anual

Usuario único con actividad durante el año o los últimos 365 días.

Diferenciar:

* Visitantes anónimos.
* Usuarios autenticados.
* Espectadores activos.
* Usuarios conectados al chat.
* Usuarios reproduciendo contenido.

## Métricas obligatorias

Mostrar en el panel:

* Usuarios online ahora.
* Espectadores reproduciendo ahora.
* Usuarios activos diarios.
* Usuarios activos semanales.
* Usuarios activos mensuales.
* Usuarios activos anuales.
* Nuevos registros.
* Usuarios recurrentes.
* Sesiones.
* Duración media.
* Partidos más vistos.
* Transmisiones más vistas.
* Pico de espectadores concurrentes.
* Tiempo total de reproducción.
* Tasa de abandono.
* Errores del reproductor.
* Buffering promedio.
* Clics de patrocinadores.
* Impresiones de patrocinadores.
* CTR.
* Participación en chat.

## Filtros

* Hoy.
* Ayer.
* Últimos 7 días.
* Últimos 30 días.
* Mes actual.
* Mes anterior.
* Año actual.
* Año anterior.
* Rango personalizado.
* Evento.
* Deporte.
* Competición.
* Transmisión.
* Dispositivo.
* País.
* Usuario autenticado o anónimo.

## Agregación

No consultar millones de eventos crudos cada vez que carga el dashboard.

Crear:

* Tablas de eventos.
* Agregaciones diarias.
* Agregaciones semanales.
* Agregaciones mensuales.
* Jobs periódicos.
* Índices adecuados.
* Retención configurable.
* Estrategia de anonimización.
* Evitar duplicados mediante identificadores idempotentes.

## Privacidad

* No almacenar más información personal de la necesaria.
* No usar fingerprinting invasivo.
* Permitir anonimización.
* Aplicar política de retención.
* Preparar consentimiento de cookies si se utilizan tecnologías no esenciales.
* Cumplir principios aplicables de LGPD.

---

# 8. PRESENCIA Y CONTADOR EN TIEMPO REAL

Implementar presencia utilizando Supabase Realtime o un servicio equivalente.

## Requisitos

* Heartbeat.
* Expiración de presencia.
* Desconexión limpia.
* Limpieza de sesiones fantasma.
* Reconexión.
* Deduplicación de múltiples pestañas.
* Diferenciar sesión, usuario y dispositivo.
* No inflar el contador por múltiples pestañas.
* Actualización en tiempo real.
* Contador visible configurable.
* Protección contra manipulación desde el cliente.

El servidor debe ser la fuente confiable para las métricas consolidadas.

---

# 9. CHAT EN VIVO

Implementar chat real asociado a transmisiones.

## Funciones

* Mensajes en tiempo real.
* Nombre y avatar.
* Indicador de usuario.
* Moderadores identificados.
* Emojis.
* Respuestas.
* Eliminación propia dentro de reglas configurables.
* Eliminación por moderador.
* Silenciar.
* Bloquear.
* Reportar mensaje.
* Slow mode.
* Rate limiting.
* Anti-spam.
* Filtro básico configurable.
* Historial paginado.
* Estado de conexión.
* Reconexión.
* Scroll controlado.
* Mensajes fijados.
* Anuncios administrativos.

## Seguridad

* Validar longitud.
* Sanitizar contenido.
* Impedir XSS.
* Evitar HTML arbitrario.
* Limitar frecuencia.
* Registrar moderación.
* RLS por sala.
* Bloquear usuarios suspendidos.

---

# 10. SPORTSRC

Integrar SportSRC desde el backend.

## Datos esperados

Según disponibilidad del plan contratado:

* Deportes.
* Ligas.
* Competiciones.
* Partidos.
* Horarios.
* Estado.
* Marcadores.
* Equipos.
* Logos.
* Estadísticas.
* Incidentes.
* Alineaciones.
* Tablas.
* Fuentes de reproducción cuando estén disponibles.

## Requisitos técnicos

* Cliente HTTP centralizado.
* API key solo en backend.
* Caché por tipo de endpoint.
* Timeouts.
* Reintentos con backoff.
* No reintentar errores no recuperables.
* Manejo de rate limit.
* Registro de cuota.
* Normalización de datos.
* Sincronización incremental.
* IDs externos separados de IDs internos.
* Detección de duplicados.
* Mapeo de estados.
* Tolerancia a campos ausentes.
* Almacenamiento de respuesta cruda solo cuando sea necesario para auditoría.
* Jobs de actualización diferenciados:

  * Próximos eventos.
  * Eventos en vivo.
  * Eventos finalizados.
* Mayor frecuencia para eventos en vivo.
* Menor frecuencia para eventos históricos.

---

# 11. MODELO DE DATOS

Diseñar migraciones para entidades similares a:

```text
profiles
user_roles
user_sessions
presence_sessions
activity_events
analytics_daily
analytics_weekly
analytics_monthly
sports
competitions
teams
matches
streams
stream_sources
stream_fallbacks
stream_events
stream_viewer_sessions
player_errors
sponsors
sponsor_campaigns
sponsor_placements
sponsor_impressions
sponsor_clicks
chat_rooms
chat_messages
chat_moderation_actions
audit_logs
app_settings
```

## Requisitos

* UUID.
* Timestamps.
* Soft delete donde sea conveniente.
* Claves foráneas.
* Índices.
* Restricciones.
* Unicidad.
* Estados mediante enums o constraints controlados.
* Migraciones reversibles cuando sea posible.
* RLS.
* Datos de auditoría.

---

# 12. PANEL ADMINISTRATIVO

Crear un panel profesional con:

```text
/admin
/admin/dashboard
/admin/streams
/admin/matches
/admin/sponsors
/admin/users
/admin/chat
/admin/analytics
/admin/settings
/admin/audit
```

## Dashboard

Mostrar:

* Transmisión activa.
* Próximo partido.
* Usuarios online.
* Espectadores activos.
* DAU.
* WAU.
* MAU.
* Usuarios activos anuales.
* Registros recientes.
* Estado de SportSRC.
* Cuota de API.
* Errores del reproductor.
* Estado de sincronización.
* Patrocinadores activos.
* Impresiones y clics.
* Alertas operativas.

## Configuración global

Permitir administrar:

* Nombre de la plataforma.
* Logo.
* Favicon.
* Colores.
* Redes sociales.
* Zona horaria.
* Idioma.
* Transmisión predeterminada.
* Poster predeterminado.
* Mensaje sin transmisión.
* Configuración de chat.
* Configuración de presencia.
* Configuración de analítica.
* Dominios de embed permitidos.
* Proveedores multimedia habilitados.
* Límites de carga.
* Políticas de contenido.

---

# 13. SEGURIDAD

Aplicar como mínimo:

* CSP.
* HSTS.
* X-Content-Type-Options.
* Referrer-Policy.
* Permissions-Policy.
* Protección contra clickjacking.
* Cookies seguras.
* `HttpOnly`.
* `Secure`.
* `SameSite`.
* CSRF donde aplique.
* Prevención XSS.
* Prevención SQL injection.
* Validación de URLs.
* Prevención SSRF.
* Allowlist de proveedores.
* Validación de archivos.
* MIME type real.
* Límites de tamaño.
* Nombres de archivo seguros.
* URLs firmadas cuando aplique.
* Rate limiting.
* Auditoría.
* Protección de endpoints administrativos.
* Gestión de secretos.
* Separación de entornos.
* No incluir secretos en variables públicas.
* No registrar tokens completos.
* No confiar en headers enviados por cliente sin validación.

## SSRF

Al validar URLs multimedia desde backend:

* Bloquear localhost.
* Bloquear rangos privados.
* Bloquear metadata endpoints.
* Bloquear protocolos no permitidos.
* Resolver DNS con protección contra rebinding.
* Limitar redirecciones.
* Limitar tamaño de respuesta.
* Aplicar timeout.

## Embeds

* Mantener allowlist de dominios.
* No guardar HTML arbitrario sin sanitización.
* No usar `dangerouslySetInnerHTML` con datos no confiables.
* Parsear y reconstruir iframes autorizados.

---

# 14. RENDIMIENTO

Implementar:

* Server Components donde aporten valor.
* Client Components solo cuando sea necesario.
* Lazy loading.
* Dynamic imports.
* Caché.
* Revalidación.
* Optimización de imágenes.
* Skeletons.
* Evitar re-renderizados.
* Paginación.
* Índices de base de datos.
* No cargar analítica completa en el frontend.
* No procesar manifiestos HLS desde el cliente innecesariamente.
* No precargar videos pesados automáticamente.
* Cancelar solicitudes obsoletas.
* Evitar fugas de memoria.
* Limpiar suscripciones Realtime.
* Limpiar timers.
* Limpiar reproductores.

---

# 15. EXPERIENCIA RESPONSIVE

Validar:

* 320 px.
* 375 px.
* 390 px.
* 768 px.
* 1024 px.
* 1280 px.
* 1440 px.
* Pantallas grandes.

El reproductor debe conservar proporción adecuada y controles utilizables.

El panel administrativo debe incluir:

* Tablas adaptables.
* Filtros móviles.
* Menú lateral colapsable.
* Acciones accesibles.
* Formularios utilizables en móvil.
* Estados de carga, vacío y error.

---

# 16. ESTADOS OBLIGATORIOS

Cada módulo debe contemplar:

* Loading.
* Empty.
* Error.
* Offline.
* Unauthorized.
* Forbidden.
* Not found.
* Partial data.
* Timeout.
* Rate limited.
* Retry.
* Success.
* Disabled.
* Scheduled.
* Live.
* Ended.

No dejar pantallas en blanco ni errores genéricos sin manejo.

---

# 17. AUDITORÍA

Registrar acciones sensibles:

* Login administrativo.
* Cambio de roles.
* Creación y edición de transmisiones.
* Publicación y despublicación.
* Cambio de fuente.
* Cambio de transmisión principal.
* Creación y edición de patrocinadores.
* Eliminación de mensajes.
* Bloqueo de usuarios.
* Cambio de configuración.
* Errores críticos.
* Exportación de datos.

Guardar:

* Actor.
* Acción.
* Entidad.
* ID.
* Valores anteriores y nuevos cuando sea seguro.
* Fecha.
* IP anonimizada o protegida.
* User agent resumido.
* Resultado.

No guardar secretos ni tokens.

---

# 18. PRUEBAS OBLIGATORIAS

## Unitarias

* Normalización de SportSRC.
* Validación de fuentes.
* Detección de tipo multimedia.
* Cálculo de usuarios activos.
* Deduplicación.
* Permisos.
* Reglas de patrocinadores.
* Sanitización.
* Fallback de streams.

## Integración

* Registro.
* Login normal.
* Login Google.
* Protección de rutas.
* CRUD de transmisiones.
* CRUD de patrocinadores.
* Sincronización SportSRC.
* Chat.
* Analítica.
* Presencia.
* RLS.
* Carga de archivos.
* Publicación programada.

## E2E

Probar como mínimo:

1. Usuario se registra.
2. Usuario confirma su cuenta.
3. Usuario inicia sesión.
4. Usuario inicia sesión con Google.
5. Administrador crea una transmisión.
6. Administrador prueba un `.m3u8`.
7. Administrador configura YouTube Live.
8. Administrador configura un `.mp4`.
9. Administrador configura un `.mp3`.
10. Administrador agrega un embed autorizado.
11. Administrador activa una transmisión principal.
12. Usuario visualiza la transmisión.
13. Usuario entra al chat.
14. El contador de espectadores cambia correctamente.
15. El reproductor usa un fallback cuando falla la fuente principal.
16. Administrador crea patrocinadores.
17. El slider refleja cambios sin desplegar código.
18. Se registran impresiones reales.
19. Se registran clics.
20. Las métricas aparecen en el panel.
21. Un usuario común no accede a rutas administrativas.
22. Un moderador no cambia roles.
23. Un embed no autorizado es rechazado.
24. Una URL interna para SSRF es rechazada.
25. El sistema maneja SportSRC fuera de servicio.

## Validaciones finales

Ejecutar:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Corregir todos los errores antes de finalizar.

No silenciar errores con:

* `any`.
* `@ts-ignore`.
* Desactivación global de ESLint.
* Capturas de errores vacías.
* Valores simulados permanentes.

---

# 19. VARIABLES DE ENTORNO

Crear `.env.example` sin secretos reales.

Incluir, según corresponda:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DATABASE_URL=

SPORTSRC_API_KEY=
SPORTSRC_BASE_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

STREAM_PROVIDER=
STREAM_INGEST_URL=
STREAM_PLAYBACK_BASE_URL=

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

ANALYTICS_RETENTION_DAYS=
PRESENCE_TIMEOUT_SECONDS=
ALLOWED_EMBED_DOMAINS=
```

Validar variables al iniciar.

Diferenciar claramente:

* Variables públicas.
* Variables privadas.
* Configuración de frontend.
* Configuración de backend.
* Secretos de producción.

---

# 20. DEVOPS Y DESPLIEGUE

## Vercel

* Frontend.
* Variables públicas y privadas necesarias para SSR.
* Preview deployments.
* Producción.
* Headers de seguridad.
* Dominio principal.

## Render

* API.
* Background worker.
* Cron jobs.
* Health checks.
* Auto-deploy controlado.
* Variables secretas.
* Logs.
* Alertas.
* Estrategia de reinicio.

## Supabase

* Migraciones versionadas.
* RLS.
* Auth.
* OAuth Google.
* Realtime.
* Storage.
* Backups.
* Índices.

## Cloudflare

* DNS.
* Proxy.
* WAF.
* Rate limits.
* Cache rules.
* Bot protection.
* Reglas para `/api`.
* Reglas especiales para `/admin`.
* No cachear datos privados.
* No cachear sesiones.
* No romper WebSocket ni Realtime.

---

# 21. DOCUMENTACIÓN

Crear o actualizar:

```text
README.md
docs/architecture.md
docs/player.md
docs/streaming-obs.md
docs/sportsrc.md
docs/authentication.md
docs/analytics.md
docs/sponsors.md
docs/security.md
docs/deployment.md
docs/testing.md
```

La documentación debe explicar:

* Arquitectura.
* Flujo de datos.
* Configuración.
* Desarrollo local.
* Despliegue.
* OBS.
* RTMP a HLS.
* Fuentes admitidas.
* Gestión del reproductor.
* Gestión de patrocinadores.
* Métricas.
* Seguridad.
* Diagnóstico.
* Recuperación ante fallos.

---

# 22. CRITERIOS DE ACEPTACIÓN

La tarea se considera completada únicamente cuando:

* El frontend está conectado a servicios reales.
* El panel administra el reproductor sin modificar código.
* Funciona YouTube.
* Funciona YouTube Live.
* Funciona `.mp4`.
* Funciona `.mp3`.
* Funciona `.m3u8`.
* Existe arquitectura correcta para OBS.
* Los embeds se validan mediante allowlist.
* Existe fallback de fuentes.
* Los errores del reproductor se manejan.
* El administrador puede publicar y programar transmisiones.
* El administrador puede gestionar patrocinadores.
* El slider obtiene los patrocinadores desde base de datos.
* El slider es responsive y animado.
* Funcionan el registro normal y el login con Google.
* Existen roles y permisos reales.
* Se calculan usuarios activos diarios, semanales, mensuales y anuales.
* Se muestran espectadores concurrentes.
* Existe presencia en tiempo real.
* Existe chat moderable.
* SportSRC funciona desde backend.
* Existen caché y sincronización.
* RLS está habilitado y probado.
* Las rutas administrativas están protegidas.
* No existen secretos expuestos.
* Las pruebas pasan.
* El lint pasa.
* El typecheck pasa.
* El build pasa.
* La documentación está completa.
* No quedan datos mock utilizados como implementación definitiva.
* No quedan botones sin funcionalidad.
* No quedan secciones “próximamente”.
* No quedan TODO críticos sin resolver.

---

# 23. FORMATO DEL REPORTE FINAL

Al terminar, entrega un reporte con:

1. Resumen ejecutivo.
2. Arquitectura encontrada.
3. Arquitectura implementada.
4. Archivos creados.
5. Archivos modificados.
6. Migraciones creadas.
7. Tablas y políticas RLS.
8. Rutas frontend.
9. Endpoints backend.
10. Funciones del reproductor.
11. Integración OBS.
12. Funciones de patrocinadores.
13. Autenticación.
14. Analítica.
15. Seguridad aplicada.
16. Pruebas ejecutadas.
17. Resultado de lint.
18. Resultado de typecheck.
19. Resultado de tests.
20. Resultado de build.
21. Variables de entorno necesarias.
22. Configuración manual pendiente en Supabase, Google, Render, Vercel o Cloudflare.
23. Riesgos restantes.
24. Evidencias de funcionamiento.
25. Casos no cubiertos, si existieran.

No declares que algo funciona si no fue probado.

Cuando una prueba dependa de una credencial o infraestructura no disponible, implementa todo lo posible, crea pruebas mediante mocks controlados solamente para el test y documenta exactamente la validación manual pendiente.

Empieza inspeccionando el repositorio actual y crea un plan de implementación por fases. Después ejecuta el trabajo completo sin detenerte en una simple propuesta.


