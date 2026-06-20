
# Arena Live Sports — Plan de construcción

Aplicación frontend (React + TS + Vite + Tailwind + shadcn) navegable, modular y preparada para integrar backend. Sin landing: experiencia funcional con player, chat local, partidos en vivo, próximos, resultados, competiciones, posiciones, noticias y patrocinadores.

## 1. Identidad visual y design system

- Tokens en `src/index.css` y `tailwind.config.ts`:
  - `--background` negro carbón, `--surface` gris azulado, `--card` azul muy oscuro
  - `--primary` verde neón con `--primary-glow`
  - `--live` rojo, `--warning` ámbar, `--foreground` blanco, `--muted-foreground` gris claro
  - Gradientes (`--gradient-hero`, `--gradient-surface`), sombras (`--shadow-glow`, `--shadow-elegant`), bordes blancos baja opacidad
- Tipografía sans fuerte (Space Grotesk display + Inter body via Google Fonts)
- Variantes de `Button` (hero, live, ghost-glow), `Badge` (live, status), respetando `prefers-reduced-motion`

## 2. Stack y dependencias

Añadir: `hls.js`, `@studio-freight/lenis`, `gsap`, `date-fns`, `recharts`, `zod` (ya), `react-hook-form` (ya). Mantener tanstack-query y react-router.

## 3. Arquitectura de carpetas

```
src/
  app/ (App, router, providers)
  components/{layout,live,chat,matches,competitions,sponsors,content,feedback}
  pages/ (Home, Live, Matches, Competitions, Calendar, Results, MatchDetails, Privacy, Terms, Cookies, Contact, BroadcastRights, SponsorsInfo, CommunityRules)
  hooks/ (useLiveStream, useMatches, useChat, useNetworkStatus, useMediaQuery)
  services/ (matches, streaming, chat, sponsors)
  schemas/ (match, stream, chat con Zod)
  types/
  data/ (mocks: matches, chat, competitions, standings, sponsors, news, highlights)
  lib/ (urlAllowlist, format)
  styles/
```

## 4. Tipos y validación

`Match`, `Team`, `Competition`, `StreamSource`, `StreamStatus`, `ChatMessage`, `ChatUser`, `Sponsor`, `StandingRow`, `NewsArticle`, `Highlight`. Enums solicitados (`MatchStatus`, `StreamType`, `StreamStatus`). Zod valida URLs https + allowlist (youtube.com/embed, tiktok.com/embed, dominios propios HLS demo).

## 5. Layout global

- `Header` sticky: logo, nav (Inicio, En vivo, Partidos, Competiciones, Calendario, Resultados), selector deporte, búsqueda, idioma (ES/EN demo), login, CTA "Ver en vivo". Focus visible, NavLink activo.
- `MobileNavigation` (Sheet) accesible: cierre al navegar, scroll lock correcto.
- `BottomNav` móvil con safe-area-inset-bottom.
- `Footer` con todas las rutas legales reales.
- `PageContainer` y `Providers` (QueryClient, Tooltip, Toaster, Sonner, BrowserRouter).

## 6. Hero / Live player + chat

- Desktop grid 70/30; móvil player → resumen → chat colapsable (Sheet).
- `LivePlayer` orquesta `HlsPlayer`, `Html5Player`, `EmbedPlayer` según `StreamSource.type`.
- `HlsPlayer`: dynamic import de `hls.js`, soporte nativo Safari, cleanup (`destroy`), eventos buffering/error/recovery, sin autoplay con sonido.
- `EmbedPlayer`: allowlist + sandbox + `allow` mínimo, `referrerPolicy="strict-origin-when-cross-origin"`, gate de consentimiento (TikTok/YouTube cookies) antes de cargar iframe.
- `PlayerOverlay`: LIVE badge, competición, equipos, marcador, minuto, espectadores, conexión.
- `PlayerControls`: volumen, fullscreen, PiP, calidad (demo), compartir, share copia link via `navigator.clipboard` con toast.
- Demo state selector (activo, sin transmisión, error con código ficticio, reconectando, embed bloqueado, skeleton) — cada uno con UI específica y CTA reintento / cambiar partido.
- `Scoreboard` con `aria-live="polite"`.

## 7. Chat local

- `ChatPanel` scroll independiente, tabs Comunidad / Oficial, lista virtual simple, mensajes texto plano, avatar/nombre/hora/insignias, reacciones, emoji picker básico (lista fija), reportar (toast demo), fijados, slow mode (deshabilita N seg), normas.
- `ChatComposer`: validación zod (1..280 chars), Enter envía, Shift+Enter newline, contador.
- Auto-scroll solo si usuario está cerca del final; botón "Nuevos mensajes" si no.
- Mock service emite mensajes periódicos.
- Móvil: Sheet con focus trap (Radix Dialog), retorno de foco.

## 8. Partidos

- "Jugando ahora": grid desktop / carrusel horizontal accesible (scroll-snap + flechas teclado) móvil. `LiveMatchCard` con todos los campos, `aria-current="true"` y borde primary cuando es el activo.
- Cambio de partido → actualiza player, scoreboard, chat mock; mueve foco al título del evento (sin scroll abrupto).
- `MatchFilters`: Todos, Fútbol, Baloncesto, Béisbol, Voleibol, Vóley, En vivo, Próximos, Finalizados.
- "Próximos": agrupados por fecha, selector de fecha (shadcn Calendar) y competición; Recordarme solicita Notification permission tras click explícito, toast feedback.
- "Resultados": cards compactas, Resumen/Repetición con `disabled` real cuando no aplica.
- `MatchDetailsPage`: scoreboard, lineups mock, timeline, highlights, chat.

## 9. Competiciones y posiciones

- `CompetitionCard` con seguir/siguiendo (estado local + toast).
- `StandingsTable` accesible: thead/scope, móvil scroll horizontal con primera columna sticky.

## 10. Patrocinadores y ads

- `SponsorCarousel` (Embla) pausa hover/focus, respeta reduced-motion.
- `AdvertisementSlot` con dimensiones reservadas para evitar CLS, etiqueta "Contenido patrocinado".
- Slots: bajo player, entre secciones, lateral desktop. Nunca sobre player/controles/chat.

## 11. Noticias y destacados

- `NewsCard`, `VideoHighlightCard` con lazy loading (`loading="lazy"`), alt descriptivo, hover/focus.

## 12. Páginas legales y secundarias

Privacidad, Términos, Cookies, Normas de comunidad, Contacto, Derechos de transmisión, Patrocinadores info — contenido real corto, no lorem.

## 13. Accesibilidad y rendimiento

- WCAG 2.2 AA: contraste, focus-visible global, landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`), single H1 por página.
- Tap targets ≥44px.
- `useReducedMotion` desactiva GSAP/Lenis.
- Dynamic import de HLS y de páginas secundarias (`React.lazy`).
- Cleanup de listeners/timers en todos los hooks.
- `useNetworkStatus` (navigator.onLine + events) → `OfflineState`.

## 14. Seguridad

- Sin `dangerouslySetInnerHTML`. URLs validadas Zod + allowlist en `lib/urlAllowlist.ts`. Iframes con sandbox y allow mínimos. Links externos `rel="noopener noreferrer"`. Comentarios claros: auth/moderación/WebSocket/firma URLs requieren backend.

## 15. SEO básico

- Meta title/description por página vía `<title>` y `<meta>` actualizados en cada Page con un hook ligero.
- sitemap.xml según directiva del proyecto (predev/prebuild).

## 16. Mocks y demo data

10+ partidos (mix de estados y deportes), 3 competiciones con tablas, 8 patrocinadores ficticios (Nexora, Veltrix, Orbit Energy, Pulse Mobile, +4 inventados), 6 noticias, 6 highlights, 30 mensajes chat seed, 2 streams demo (HLS test stream público https + embed YouTube demo).

## 17. Validación final

Ejecutar lint + typecheck + build, corregir errores, verificar preview, screenshot.

## Notas técnicas

- Stream HLS de prueba: usar URL https pública de test (Mux/Akamai) detrás de allowlist; documentar reemplazo.
- RTMP: comentario en `streaming.service` explicando que OBS → servidor intermedio → HLS/WebRTC/embed.
- GSAP/Lenis usados puntualmente (hero reveal, smooth scroll opt-in), desactivados con reduced motion.
- Sin "any". Componentes < 200 LOC. Reutilizar shadcn (Button, Card, Tabs, Sheet, Dialog, Tooltip, Toast, Badge, Calendar, Select, Carousel).

Tras aprobación, implemento el design system + arquitectura base, luego player+chat+matches+home, y finalmente páginas secundarias, legales y pulido.
