import { z } from "zod";

export const localMatchInputSchema = z.object({
  competitionName: z.string().trim().min(2, "Indica la competición").max(120),
  region: z.string().trim().min(2, "Indica la región").max(100),
  homeTeamName: z.string().trim().min(2, "Indica el equipo local").max(120),
  awayTeamName: z.string().trim().min(2, "Indica el equipo visitante").max(120),
  startsAt: z.string().datetime(),
  venue: z.string().trim().max(160).optional(),
}).superRefine((value, ctx) => {
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("es");
  if (normalize(value.homeTeamName) === normalize(value.awayTeamName)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["awayTeamName"], message: "Los equipos deben ser diferentes" });
  }
});

export type LocalMatchInput = z.infer<typeof localMatchInputSchema>;
