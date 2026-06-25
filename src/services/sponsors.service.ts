import { sponsorAdminSchema, type ManagedSponsor } from "@/schemas/sponsor.schema";
import { sponsorFromRow, sponsorLegacyColumns, type SponsorRow } from "@/schemas/sponsor.persistence";
import { publicEnv } from "@/config/env";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Sponsor } from "@/types";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface SponsorMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
}

function colorFor(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${Math.abs(hash) % 360} 72% 52%`;
}

function monogramFor(name: string) {
  return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function anonymousId() {
  let id = localStorage.getItem("arena-live:anonymous-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("arena-live:anonymous-id", id); }
  return id;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return response.json();
}

function toPublicSponsor(sponsor: ManagedSponsor): Sponsor {
  return {
    id: sponsor.id,
    name: sponsor.name,
    tagline: sponsor.description,
    url: sponsor.destinationUrl,
    logoUrl: sponsor.logoUrl,
    darkLogoUrl: sponsor.darkLogoUrl,
    altText: sponsor.altText,
    monogram: monogramFor(sponsor.name),
    color: colorFor(sponsor.id),
    tier: sponsor.type,
  };
}

export async function listSponsors(): Promise<Sponsor[]> {
  if (!isSupabaseConfigured) return fetch(`${API_BASE}/sponsors`).then(responseJson<Sponsor[]>);
  const client = await getSupabaseClient();
  const { data, error }: { data: SponsorRow[] | null; error: { message: string; code?: string } | null } = await client.from("sponsors")
    .select(sponsorLegacyColumns)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("priority", { ascending: false });
  if (error) return fetch(`${API_BASE}/sponsors`).then(responseJson<Sponsor[]>);
  const now = Date.now();
  return (data as unknown as SponsorRow[])
    .filter((row) => (!row.starts_at || new Date(row.starts_at).getTime() <= now) && (!row.ends_at || new Date(row.ends_at).getTime() > now))
    .map(sponsorFromRow)
    .map(toPublicSponsor);
}

export async function listManagedSponsors(token: string): Promise<ManagedSponsor[]> {
  return fetch(`${API_BASE}/admin/sponsors`, { headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
}

export async function saveManagedSponsor(input: ManagedSponsor, token: string): Promise<ManagedSponsor[]> {
  const sponsor = sponsorAdminSchema.parse(input);
  return fetch(`${API_BASE}/admin/sponsors`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(sponsor) }).then(responseJson<ManagedSponsor[]>);
}

export async function deleteManagedSponsor(id: string, token: string): Promise<ManagedSponsor[]> {
  return fetch(`${API_BASE}/admin/sponsors/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
}

export async function listSponsorMetrics(): Promise<Record<string, SponsorMetrics>> {
  if (!isSupabaseConfigured) return {};
  const client = await getSupabaseClient();
  const [{ data: impressions, error: impressionError }, { data: clicks, error: clickError }] = await Promise.all([
    client.from("sponsor_impressions").select("sponsor_id"),
    client.from("sponsor_clicks").select("sponsor_id"),
  ]);
  if (impressionError) throw new Error(impressionError.message);
  if (clickError) throw new Error(clickError.message);
  const result: Record<string, SponsorMetrics> = {};
  for (const row of impressions ?? []) {
    const id = String(row.sponsor_id);
    result[id] ??= { impressions: 0, clicks: 0, ctr: 0 };
    result[id].impressions++;
  }
  for (const row of clicks ?? []) {
    const id = String(row.sponsor_id);
    result[id] ??= { impressions: 0, clicks: 0, ctr: 0 };
    result[id].clicks++;
  }
  for (const metric of Object.values(result)) metric.ctr = metric.impressions ? (metric.clicks / metric.impressions) * 100 : 0;
  return result;
}

export async function trackSponsorImpression(sponsorId: string, idempotencyKey: string, visibleRatio: number): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  const { error } = await client.from("sponsor_impressions").insert({ sponsor_id: sponsorId, idempotency_key: idempotencyKey, user_id: data.session?.user.id ?? null, anonymous_id: data.session ? null : anonymousId(), visible_ratio: Math.min(1, Math.max(0.5, visibleRatio)), device_type: matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop" });
  if (error?.code !== "23505" && error) throw new Error(error.message);
}

export async function trackSponsorClick(sponsorId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  const { error } = await client.from("sponsor_clicks").insert({ sponsor_id: sponsorId, idempotency_key: crypto.randomUUID(), user_id: data.session?.user.id ?? null, anonymous_id: data.session ? null : anonymousId(), utm: Object.fromEntries(new URLSearchParams(window.location.search).entries()) });
  if (error) throw new Error(error.message);
}

export async function getMainSponsor(): Promise<Sponsor | undefined> {
  return (await listSponsors()).find((sponsor) => sponsor.tier === "main");
}
