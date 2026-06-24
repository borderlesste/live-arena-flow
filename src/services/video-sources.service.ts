import type { StreamSource } from "@/types";
import { publicEnv } from "@/config/env";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface ManagedVideoSource extends StreamSource {
  matchId: string;
  createdAt: string;
  obs?: StreamSource["obs"] & { hasStreamKey?: boolean };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return response.json();
}

export function listPublicVideoSources(): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/video-sources`).then(parseResponse<ManagedVideoSource[]>);
}

export function listManagedVideoSources(token: string): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/admin/video-sources`, { headers: { Authorization: `Bearer ${token}` } }).then(parseResponse<ManagedVideoSource[]>);
}

export function saveManagedVideoSource(source: ManagedVideoSource, token: string): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/admin/video-sources`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(source),
  }).then(parseResponse<ManagedVideoSource[]>);
}

export function deleteManagedVideoSource(id: string, token: string): Promise<ManagedVideoSource[]> {
  return fetch(`${API_BASE}/admin/video-sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<ManagedVideoSource[]>);
}
