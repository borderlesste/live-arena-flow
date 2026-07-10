import { z } from "zod";

export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "halftime",
  "paused",
  "finished",
  "postponed",
  "cancelled",
  "unknown",
]);

export const sportSchema = z.literal("football");
