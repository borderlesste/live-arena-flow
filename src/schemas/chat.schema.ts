import { z } from "zod";

export const chatMessageInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { message: "Escribe algo antes de enviar" })
    .max(280, { message: "Máximo 280 caracteres" }),
  channel: z.enum(["community", "official"]),
});

export type ChatMessageInput = z.infer<typeof chatMessageInputSchema>;
