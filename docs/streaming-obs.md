# OBS and ingest

The supported flow is `OBS -> RTMP/SRT ingest -> transcoder/provider -> HTTPS HLS -> browser`.

The API removes OBS data from public responses. With `STREAM_SECRET_KEY` configured, newly saved stream keys are encrypted with AES-256-GCM before file persistence and are never returned by the API. Rotate keys stored before encryption was enabled. Multi-replica deployments must use shared PostgreSQL or a secret store.

