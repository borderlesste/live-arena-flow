import { describe, expect, it } from "vitest";
import { sponsorAdminSchema } from "./sponsor.schema";

const validSponsor = {
  id: "125c1b37-f4ac-448d-ac98-722c398952ac",
  name: "Arena Partner",
  logoUrl: "https://cdn.example.com/logo.svg",
  altText: "Logo de Arena Partner",
  type: "partner" as const,
  status: "active" as const,
  priority: 10,
  devices: ["mobile", "desktop"] as const,
  position: "homepage",
  utm: { utm_campaign: "final" },
};

describe("sponsor administration validation", () => {
  it("accepts a complete sponsor", () => {
    expect(sponsorAdminSchema.safeParse(validSponsor).success).toBe(true);
  });

  it("rejects insecure logo URLs", () => {
    expect(sponsorAdminSchema.safeParse({ ...validSponsor, logoUrl: "http://cdn.example.com/logo.svg" }).success).toBe(false);
  });

  it("requires a start date for scheduled sponsors", () => {
    expect(sponsorAdminSchema.safeParse({ ...validSponsor, status: "scheduled" }).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(sponsorAdminSchema.safeParse({ ...validSponsor, startsAt: "2026-07-02T12:00:00.000Z", endsAt: "2026-07-01T12:00:00.000Z" }).success).toBe(false);
  });
});
