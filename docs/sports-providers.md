# Sports Providers

## Active Contract

The backend exposes normalized sports data through `server/modules/sports`.

```ts
interface SportsProvider {
  readonly name: string;
  eventsByDate(date: string): Promise<NormalizedSportsEvent[]>;
  liveEvents(): Promise<NormalizedSportsEvent[]>;
  eventById(id: string): Promise<NormalizedSportsEvent | undefined>;
}
```

The frontend consumes only `/api/sports/events`, `/api/sports/live`, and `/api/sports/events/:id`.

## Provider Matrix

| Dato | API principal | API secundaria | Persistencia | Cache |
| --- | --- | --- | --- | --- |
| Deportes | Provider event payload | Fallback provider | Not persisted yet | In-memory request cache |
| Competiciones | Provider event payload | Fallback provider | Not persisted yet | In-memory request cache |
| Equipos | Provider event payload | Fallback provider | Not persisted yet | In-memory request cache |
| Logos | Provider event payload | Fallback provider | Not persisted yet | In-memory request cache |
| Partidos | SportsDataIO or TheSportsDB | Fallback provider | Not persisted yet | 5 minutes by date |
| En vivo | Dedicated provider live endpoint when configured, otherwise date-window filter | Fallback provider | Not persisted yet | 60 seconds |
| Resultados | Date endpoint | Fallback provider | Not persisted yet | 5 minutes by date |
| Estadisticas | Not implemented | Not implemented | None | None |
| Alineaciones | Not implemented | Not implemented | None | None |
| Streams | Admin-managed app data | N/A | JSON fallback; Supabase target pending | None |

## Current Decisions

- SportsDataIO/SportSRC is the preferred production primary only when `SPORTSRC_BASE_URL` and `SPORTSRC_API_KEY` are valid.
- TheSportsDB is a safe fallback and the default development provider.
- TheSportsDB public key fallback is development-only; production now requires a configured sports provider.
- The frontend is insulated from provider-native field names.

## Pending Hardening

- Persist normalized match snapshots in Supabase to reduce provider quota pressure.
- Add provider health and quota metrics to admin diagnostics.
- Store provider source metadata and external IDs to prevent duplicates across providers.
- Add scheduled sync jobs only after deployment ownership is chosen.
