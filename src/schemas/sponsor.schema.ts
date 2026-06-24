import { z } from "zod";

const optionalHttpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "La URL debe usar HTTPS").optional();

export const sponsorAdminSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  logoUrl: z.string().url().refine((value) => new URL(value).protocol === "https:", "La URL debe usar HTTPS"),
  darkLogoUrl: optionalHttpsUrl,
  altText: z.string().trim().min(2).max(160),
  destinationUrl: optionalHttpsUrl,
  description: z.string().trim().max(500).optional(),
  type: z.enum(["main", "official", "partner"]),
  status: z.enum(["draft", "scheduled", "active", "paused", "ended"]),
  priority: z.number().int().min(0).max(10_000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  devices: z.array(z.enum(["mobile", "tablet", "desktop", "tv"])).min(1),
  position: z.string().trim().min(1).max(80),
  campaign: z.string().trim().max(120).optional(),
  competitionId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  utm: z.record(z.string(), z.string().max(200)),
  maxImpressions: z.number().int().positive().optional(),
  maxClicks: z.number().int().positive().optional(),
}).superRefine((sponsor, context) => {
  if (sponsor.startsAt && sponsor.endsAt && new Date(sponsor.endsAt) <= new Date(sponsor.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "La fecha final debe ser posterior al inicio" });
  }
  if (sponsor.status === "scheduled" && !sponsor.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["startsAt"], message: "Un patrocinador programado necesita fecha de inicio" });
  }
});

export type ManagedSponsor = z.infer<typeof sponsorAdminSchema>;
