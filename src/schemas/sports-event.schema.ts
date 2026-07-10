import { z } from "zod";

const teamSchema = z.object({ id: z.string(), name: z.string(), badgeUrl: z.string().url().optional() });

export const normalizedSportsEventSchema = z.object({
  id: z.string(), startsAt: z.string().datetime(), sport: z.enum(["Football", "football", "Soccer", "soccer"]),
  competition: z.object({ id: z.string(), name: z.string(), region: z.string().optional(), badgeUrl: z.string().url().optional() }),
  homeTeam: teamSchema, awayTeam: teamSchema,
  homeScore: z.number().int().nonnegative(), awayScore: z.number().int().nonnegative(),
  status: z.enum(["scheduled", "live", "halftime", "paused", "finished", "postponed", "cancelled", "unknown"]),
  statusLabel: z.string().optional(), venue: z.string().optional(), city: z.string().optional(),
  phase: z.string().optional(), group: z.string().optional(), highlightUrl: z.string().url().optional(),
});

export const sportsEventsResponseSchema = z.object({ provider: z.string(), events: z.array(normalizedSportsEventSchema) });
export type NormalizedSportsEvent = z.infer<typeof normalizedSportsEventSchema>;
