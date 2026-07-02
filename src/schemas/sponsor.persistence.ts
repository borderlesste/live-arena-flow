import { sponsorAdminSchema, type ManagedSponsor } from "./sponsor.schema.ts";

export interface SponsorRow {
  id: string;
  name: string;
  image?: string | null;
  logo_url: string | null;
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

export const sponsorColumns = "id,name,image,logo_url,dark_logo_url,alt_text,destination_url,description,sponsor_type,status,priority,starts_at,ends_at,enabled_devices,placement,campaign,competition_id,match_id,stream_id,utm,max_impressions,max_clicks";
export const sponsorPublicColumns = "id,name,image,logo_url,dark_logo_url,alt_text,destination_url,description,status,priority,starts_at,ends_at";
export const sponsorLegacyColumns = "id,name,logo_url,dark_logo_url,alt_text,destination_url,description,status,priority,starts_at,ends_at";

export function isMissingSponsorColumn(error: { message?: string; code?: string } | null) {
  return Boolean(error && (
    error.code === "42703"
    || error.code === "PGRST204"
    || error.message?.includes("column")
    || error.message?.includes("sponsor_type")
    || error.message?.includes("enabled_devices")
    || error.message?.includes("campaign")
    || error.message?.includes("max_impressions")
  ));
}

export function sponsorFromRow(row: SponsorRow): ManagedSponsor {
  return sponsorAdminSchema.parse({
    id: row.id,
    name: row.name,
    image: row.image ?? undefined,
    logoUrl: row.logo_url ?? undefined,
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

export function sponsorToRow(sponsor: ManagedSponsor) {
  return {
    id: sponsor.id,
    name: sponsor.name,
    image: sponsor.image ?? null,
    logo_url: sponsor.logoUrl ?? null,
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

export function sponsorToLegacyRow(sponsor: ManagedSponsor) {
  return {
    id: sponsor.id,
    name: sponsor.name,
    logo_url: sponsor.logoUrl ?? null,
    dark_logo_url: sponsor.darkLogoUrl ?? null,
    alt_text: sponsor.altText,
    destination_url: sponsor.destinationUrl ?? null,
    description: sponsor.description ?? null,
    status: sponsor.status,
    priority: sponsor.priority,
    starts_at: sponsor.startsAt ?? null,
    ends_at: sponsor.endsAt ?? null,
    deleted_at: null,
  };
}
