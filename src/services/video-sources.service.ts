import type { StreamSource } from "@/types";
import { publicEnv } from "@/config/env";
import type { CreateLiveSourceResponse, LiveSourceStatus } from "@/schemas/live-source.schema";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface ManagedVideoSource extends StreamSource {
  matchId: string;
  createdAt: string;
  sourceKind?: "manual" | "obs";
  usageType?: "live" | "highlight" | "prerecorded";
  playbackFormat?: string;
  playbackUrl?: string;
  /** Streaming provider name — "custom" for RTMP, or any provider identifier. */
  provider?: string;
  providerInputId?: string;
  ingestProtocol?: "rtmp" | "rtmps" | "srt";
  ingestUrl?: string;
  streamKeyLast4?: string;
  hasStreamKey?: boolean;
  status?: LiveSourceStatus;
  statusMessage?: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
  recordingEnabled?: boolean;
  lowLatencyEnabled?: boolean;
  updatedAt?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastProviderSyncAt?: string;
  providerErrorCode?: string;
  obs?: StreamSource["obs"] & { hasStreamKey?: boolean };
}

export interface CreateLiveSourcePayload {
  matchId: string;
  title: string;
  sourceKind: "manual" | "obs";
  usageType: "live" | "highlight" | "prerecorded";
  playbackFormat?: string;
  playbackUrl?: string;
  ingestProtocol?: "rtmp" | "rtmps" | "srt";
  recordingEnabled?: boolean;
  lowLatencyEnabled?: boolean;
  /** Idempotency key — prevents duplicate entries on double-click */
  idempotencyKey: string;
}

export interface CredentialsRevealResponse {
  ingestUrl: string;
  ingestProtocol: "rtmp" | "rtmps" | "srt";
  streamKey: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const errField = body?.error;
    const message =
      (typeof errField === "object" && errField !== null && "message" in errField)
        ? String((errField as { message: unknown }).message)
        : typeof errField === "string"
          ? errField
          : `El backend respondió ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function listPublicVideoSources(): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/video-sources`).then(parseResponse<ManagedVideoSource[]>);
}

export function listManagedVideoSources(token: string): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/admin/live-sources`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<ManagedVideoSource[]>);
}

/**
 * Creates a new live source. Uses an idempotency key to prevent double-submission.
 * Returns the created source (with OBS credentials on first call only).
 */
export function createLiveSource(
  payload: CreateLiveSourcePayload,
  token: string,
): Promise<CreateLiveSourceResponse<ManagedVideoSource>> {
  return fetch(`${API_BASE}/admin/live-sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": payload.idempotencyKey,
    },
    body: JSON.stringify(payload),
  }).then(parseResponse<CreateLiveSourceResponse<ManagedVideoSource>>);
}

/**
 * Updates existing source metadata.
 */
export function updateLiveSource(
  id: string,
  patch: Partial<ManagedVideoSource>,
  token: string,
): Promise<ManagedVideoSource> {
  return fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  }).then(parseResponse<ManagedVideoSource>);
}

/**
 * Legacy combined save — kept for backward compat with edit flow.
 */
export async function saveManagedVideoSource(
  source: Partial<ManagedVideoSource> & { id?: string },
  token: string,
  isEdit = false,
): Promise<ManagedVideoSource[]> {
  const url = isEdit && source.id
    ? `${API_BASE}/admin/live-sources/${encodeURIComponent(source.id)}`
    : `${API_BASE}/admin/live-sources`;

  const { id: _id, ...requestBody } = source;
  await fetch(url, {
    method: isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(requestBody),
  }).then(parseResponse<unknown>);

  return listManagedVideoSources(token);
}

export async function deleteManagedVideoSource(id: string, token: string): Promise<ManagedVideoSource[]> {
  await fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<unknown>);

  return listManagedVideoSources(token);
}

export function revealCredentials(id: string, token: string): Promise<CredentialsRevealResponse> {
  return fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}/credentials/reveal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<CredentialsRevealResponse>);
}

export function rotateCredentials(id: string, token: string): Promise<CredentialsRevealResponse> {
  return fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}/credentials/rotate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<CredentialsRevealResponse>);
}

export function enableLiveSource(id: string, token: string): Promise<{ success: boolean }> {
  return fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}/enable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<{ success: boolean }>);
}

export function disableLiveSource(id: string, token: string): Promise<{ success: boolean }> {
  return fetch(`${API_BASE}/admin/live-sources/${encodeURIComponent(id)}/disable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<{ success: boolean }>);
}

export function listLiveSourcesStatuses(
  token: string,
): Promise<{ id: string; status: ManagedVideoSource["status"] }[]> {
  return fetch(`${API_BASE}/admin/live-sources/status`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<{ id: string; status: ManagedVideoSource["status"] }[]>);
}
