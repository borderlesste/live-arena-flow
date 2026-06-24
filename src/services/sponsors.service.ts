import { sponsorAdminSchema, type ManagedSponsor } from "@/schemas/sponsor.schema";
import { publicEnv } from "@/config/env";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Sponsor } from "@/types";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface SponsorMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
}

interface SponsorRow {
  id: string;
  name: string;
  logo_url: string;
  dark_logo_url: string | null;
  alt_text: string;
  destination_url: string | null;
  description: string | null;
  sponsor_type?: ManagedSponsor["type"];
  status: ManagedSponsor["status"];
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  enabled_devices?: ManagedSponsor["devices"];
  placement?: string;
  campaign?: string | null;
  competition_id?: string | null;
  match_id?: string | null;
  stream_id?: string | null;
  utm?: Record<string, string> | null;
  max_impressions?: number | null;
  max_clicks?: number | null;
}

const sponsorColumns = "id,name,logo_url,dark_logo_url,alt_text,destination_url,description,sponsor_type,status,priority,starts_at,ends_at,enabled_devices,placement,campaign,competition_id,match_id,stream_id,utm,max_impressions,max_clicks";
const sponsorLegacyColumns = "id,name,logo_url,dark_logo_url,alt_text,destination_url,description,status,priority,starts_at,ends_at";

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

function isMissingSponsorColumn(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "42703" || error.message?.includes("sponsor_type") || error.message?.includes("enabled_devices")));
}

function fromRow(row: SponsorRow): ManagedSponsor {
  return sponsorAdminSchema.parse({
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    darkLogoUrl: row.dark_logo_url ?? undefined,
    altText: row.alt_text,
    destinationUrl: row.destination_url ?? undefined,
    description: row.description ?? undefined,
    type: row.sponsor_type ?? "partner",
    status: row.status,
    priority: row.priority,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    devices: row.enabled_devices ?? ["mobile", "tablet", "desktop", "tv"],
    position: row.placement ?? "homepage",
    campaign: row.campaign ?? undefined,
    competitionId: row.competition_id ?? undefined,
    matchId: row.match_id ?? undefined,
    streamId: row.stream_id ?? undefined,
    utm: row.utm ?? {},
    maxImpressions: row.max_impressions ?? undefined,
    maxClicks: row.max_clicks ?? undefined,
  });
}

function toRow(sponsor: ManagedSponsor) {
  return {
    id: sponsor.id,
    name: sponsor.name,
    logo_url: sponsor.logoUrl,
    dark_logo_url: sponsor.darkLogoUrl ?? null,
    alt_text: sponsor.altText,
    destination_url: sponsor.destinationUrl ?? null,
    description: sponsor.description ?? null,
    sponsor_type: sponsor.type,
    status: sponsor.status,
    priority: sponsor.priority,
    starts_at: sponsor.startsAt ?? null,
    ends_at: sponsor.endsAt ?? null,
    enabled_devices: sponsor.devices,
    placement: sponsor.position,
    campaign: sponsor.campaign ?? null,
    competition_id: sponsor.competitionId ?? null,
    match_id: sponsor.matchId ?? null,
    stream_id: sponsor.streamId ?? null,
    utm: sponsor.utm,
    max_impressions: sponsor.maxImpressions ?? null,
    max_clicks: sponsor.maxClicks ?? null,
    deleted_at: null,
  };
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
  const now = new Date().toISOString();
  let { data, error }: { data: SponsorRow[] | null; error: { message: string; code?: string } | null } = await client.from("sponsors").select(sponsorColumns)
    .eq("status", "active").is("deleted_at", null)
    .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("priority", { ascending: false });
  if (isMissingSponsorColumn(error)) {
    const legacy = await client.from("sponsors").select(sponsorLegacyColumns)
      .eq("status", "active").is("deleted_at", null)
      .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("priority", { ascending: false });
    data = legacy.data as unknown as SponsorRow[] | null;
    error = legacy.error;
  }
  if (error) throw new Error(error.message);
  return (data as unknown as SponsorRow[]).map(fromRow).map(toPublicSponsor);
}

export async function listManagedSponsors(token: string): Promise<ManagedSponsor[]> {
  if (!isSupabaseConfigured) return fetch(`${API_BASE}/admin/sponsors`, { headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
  const { data, error } = await (await getSupabaseClient()).from("sponsors").select(sponsorColumns).is("deleted_at", null).order("priority", { ascending: false });
  if (isMissingSponsorColumn(error)) return fetch(`${API_BASE}/admin/sponsors`, { headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
  if (error) throw new Error(error.message);
  return (data as unknown as SponsorRow[]).map(fromRow);
}

export async function saveManagedSponsor(input: ManagedSponsor, token: string): Promise<ManagedSponsor[]> {
  const sponsor = sponsorAdminSchema.parse(input);
  if (!isSupabaseConfigured) {
    return fetch(`${API_BASE}/admin/sponsors`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(sponsor) }).then(responseJson<ManagedSponsor[]>);
  }
  const { error } = await (await getSupabaseClient()).from("sponsors").upsert(toRow(sponsor), { onConflict: "id" });
  if (isMissingSponsorColumn(error)) return fetch(`${API_BASE}/admin/sponsors`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(sponsor) }).then(responseJson<ManagedSponsor[]>);
  if (error) throw new Error(error.message);
  return listManagedSponsors(token);
}

export async function deleteManagedSponsor(id: string, token: string): Promise<ManagedSponsor[]> {
  if (!isSupabaseConfigured) return fetch(`${API_BASE}/admin/sponsors/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
  const { error } = await (await getSupabaseClient()).from("sponsors").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (isMissingSponsorColumn(error)) return fetch(`${API_BASE}/admin/sponsors/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).then(responseJson<ManagedSponsor[]>);
  if (error) throw new Error(error.message);
  return listManagedSponsors(token);
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
