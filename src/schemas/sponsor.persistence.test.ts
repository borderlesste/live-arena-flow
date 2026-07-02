import { describe, expect, it } from "vitest";
import { sponsorFromRow, sponsorToLegacyRow, sponsorToRow } from "./sponsor.persistence";
import type { ManagedSponsor } from "./sponsor.schema";

const sponsor: ManagedSponsor = {
  id: "125c1b37-f4ac-448d-ac98-722c398952ac",
  name: "Arena Partner",
  image: "data:image/png;base64,aGVsbG8=",
  logoUrl: "https://cdn.example.com/logo.svg",
  darkLogoUrl: "https://cdn.example.com/logo-dark.svg",
  altText: "Logo de Arena Partner",
  destinationUrl: "https://example.com",
  description: "Campana principal",
  type: "official",
  status: "active",
  priority: 10,
  startsAt: "2026-07-01T12:00:00.000Z",
  endsAt: "2026-08-01T12:00:00.000Z",
  devices: ["mobile", "desktop"],
  position: "homepage-hero",
  campaign: "final-2026",
  competitionId: "8638e7bc-7ed6-4c41-ae18-9adbe633e521",
  matchId: "9f83ef3d-61d5-441d-bb3d-a4cceef1df67",
  streamId: "3c91d6c2-832a-40f8-a93d-cb5846bb6421",
  utm: { utm_source: "arena", utm_campaign: "final" },
  maxImpressions: 1000,
  maxClicks: 50,
};

describe("sponsor persistence mapping", () => {
  it("keeps every admin field when converting to and from a database row", () => {
    const row = sponsorToRow(sponsor);

    expect(row).toMatchObject({
      sponsor_type: "official",
      image: sponsor.image,
      enabled_devices: ["mobile", "desktop"],
      placement: "homepage-hero",
      campaign: "final-2026",
      competition_id: sponsor.competitionId,
      match_id: sponsor.matchId,
      stream_id: sponsor.streamId,
      utm: { utm_source: "arena", utm_campaign: "final" },
      max_impressions: 1000,
      max_clicks: 50,
    });
    expect(sponsorFromRow(row)).toEqual(sponsor);
  });

  it("can write only legacy sponsor columns when admin fields are missing", () => {
    const row = sponsorToLegacyRow(sponsor);

    expect(row).toMatchObject({
      id: sponsor.id,
      name: sponsor.name,
      logo_url: sponsor.logoUrl,
      dark_logo_url: sponsor.darkLogoUrl,
      alt_text: sponsor.altText,
      destination_url: sponsor.destinationUrl,
      description: sponsor.description,
      status: sponsor.status,
      priority: sponsor.priority,
      starts_at: sponsor.startsAt,
      ends_at: sponsor.endsAt,
      deleted_at: null,
    });
    expect(row).not.toHaveProperty("sponsor_type");
    expect(row).not.toHaveProperty("enabled_devices");
    expect(row).not.toHaveProperty("campaign");
    expect(row).not.toHaveProperty("max_impressions");
  });
});
