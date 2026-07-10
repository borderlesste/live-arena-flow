# Refactor funcional de eventos deportivos

## Causa raíz

Las vistas públicas ya compartían el mapeo básico, pero todavía consultaban ventanas y resolvían estados de forma diferente. La ruta `/mundial` consultaba 29 días relativos a la fecha actual (`-14` a `+14`), por lo que nunca podía garantizar el calendario completo del Mundial 2026 (11 de junio a 19 de julio). Además, un día persistido no vacío evitaba refrescar SportSRC, incluso si el catálogo estaba incompleto.

El calendario consultaba un único día UTC y después agrupaba en hora local. Para `America/Sao_Paulo`, los partidos entre las 00:00 y las 02:59 UTC pertenecen al día local anterior; por ello una consulta diaria podía omitir partidos de la madrugada siguiente o mezclar otro día.

## Fuente común

- SportSRC se valida y normaliza en `server/modules/sports/sportsrc.provider.ts`.
- Supabase conserva el mismo contrato en `server/modules/sports/sports-catalog.ts`.
- El frontend transforma el contrato una sola vez en `src/services/sports-data.mapper.ts`.
- Filtros y etiquetas de estado viven en `src/lib/match-filters.ts`.
- Orden, agrupación y zona horaria viven en `src/lib/format.ts`.
- La búsqueda de encabezado y `/matches` usa `src/lib/match-search.ts`.
- La identificación, rango y fases del Mundial viven en `src/lib/world-championship.ts`.

## Comportamiento por ruta

- `/live`: consume el endpoint en vivo, incorpora eventos con una fuente activa/principal, prioriza la fuente principal y muestra loading, error o vacío.
- `/matches`: busca con el mismo motor Unicode del encabezado y separa en vivo, próximos y finalizados con orden común.
- `/competitions`: deriva competiciones del catálogo normalizado, muestra total de partidos de la ventana y cantidad en vivo.
- `/calendar`: para una fecha local consulta los tres días UTC que podrían solaparla, filtra en `America/Sao_Paulo` y agrupa por el mismo día local.
- `/results`: filtra únicamente `finished` y agrupa del más reciente al más antiguo.
- `/mundial`: consulta en una llamada el rango inclusivo 2026-06-11 a 2026-07-19, deduplica por ID y agrupa por fase y luego por fecha.

## Fallback y seguridad

La lectura diaria intenta SportSRC, sincroniza Supabase y devuelve el catálogo combinado para preservar partidos locales. Si el proveedor falla, devuelve el catálogo persistido. El rango está limitado a 62 días y cuatro consultas concurrentes. Las URLs y envelopes externos siguen validados en servidor; la clave de SportSRC nunca sale al navegador.

Los estados externos desconocidos se conservan como `unknown` en lugar de mostrarse falsamente como programados. La migración `20260710130000_add_unknown_match_status.sql` amplía de forma aditiva la restricción del catálogo.
