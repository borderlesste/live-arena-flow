import { BRAND_DEFAULTS, type BrandSettings } from "@/components/brand/brand-config";
import { publicEnv } from "@/config/env";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

async function parseBrand(response: Response): Promise<BrandSettings> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return { ...BRAND_DEFAULTS, ...await response.json() };
}

export function getBrandSettings(): Promise<BrandSettings> {
  return fetch(`${API_BASE}/brand`).then(parseBrand);
}

export function saveBrandSettings(settings: BrandSettings, token: string): Promise<BrandSettings> {
  return fetch(`${API_BASE}/admin/brand`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings),
  }).then(parseBrand);
}
