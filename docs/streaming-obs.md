# OBS and ingest

The supported flow is `OBS -> RTMP/SRT ingest -> transcoder/provider -> HTTPS HLS -> browser`.

The public API removes all ingest data. A newly created admin source returns credentials once in `{ source, credentials, replayed: false }`; an idempotent replay never returns them. Cloudflare credentials are retrieved from the provider for an explicit reveal. Custom-provider keys use AES-256-GCM when `STREAM_SECRET_KEY` is configured.

Custom RTMP never derives playback from the publishing key. It remains absent from the public API until an administrator supplies a separate HTTPS playback URL.

Cloudflare enable/disable uses `PUT { enabled }`. Rotation creates a replacement Live Input before switching locally and queues cleanup of the previous UID. Live webhook payloads use `data.input_id`, `data.event_type`, and `data.updated_at`.

Cloudflare HLS playback requires `recording.mode=automatic`. The `off` mode can accept an encoder connection but does not make the Live Input available through the HLS manifest. The application builds the manifest as `https://customer-{code}.cloudflarestream.com/{uid}/manifest/video.m3u8` and the browser requests it directly from Cloudflare.

Configure Cloudflare Notifications with:

- URL: `https://luisromerofutbol.com/api/webhooks/cloudflare/stream-live`
- Secret: the current `CLOUDFLARE_STREAM_WEBHOOK_SECRET`
- Events: `live_input.connected`, `live_input.disconnected`, and `live_input.errored` when available

The admin panel polls the grouped status endpoint while visible as a fallback. The webhook remains preferred because it updates `last_connected_at`, `last_disconnected_at`, and `last_provider_sync_at` without waiting for the next poll.

For OBS Studio select `Servicio: Personalizado`, copy the RTMPS server and stream key from the credential panel, use H.264 video, AAC audio, CBR, and a fixed keyframe interval between two and eight seconds. Do not paste the HLS URL into OBS.

The committed webhook secret was removed and must be treated as compromised: rotate it before enabling Cloudflare Notifications.
