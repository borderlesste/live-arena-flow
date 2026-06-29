# OBS and ingest

The supported flow is `OBS -> RTMP/SRT ingest -> transcoder/provider -> HTTPS HLS -> browser`.

The public API removes all ingest data. A newly created admin source returns credentials once in `{ source, credentials, replayed: false }`; an idempotent replay never returns them. Cloudflare credentials are retrieved from the provider for an explicit reveal. Custom-provider keys use AES-256-GCM when `STREAM_SECRET_KEY` is configured.

Custom RTMP never derives playback from the publishing key. It remains absent from the public API until an administrator supplies a separate HTTPS playback URL.

Cloudflare enable/disable uses `PUT { enabled }`. Rotation creates a replacement Live Input before switching locally and queues cleanup of the previous UID. Live webhook payloads use `data.input_id`, `data.event_type`, and `data.updated_at`.

The committed webhook secret was removed and must be treated as compromised: rotate it before enabling Cloudflare Notifications.
