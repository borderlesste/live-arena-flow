import { z } from "zod";

// Domains allowed for iframe embeds. Anything else is blocked at runtime.
export const EMBED_ALLOWLIST = [
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
  "player.vimeo.com",
  "www.tiktok.com",
] as const;

const playableUrl = z
  .string()
  .url()
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" || ((["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:"));
    } catch {
      return false;
    }
  }, { message: "Usa HTTPS o HTTP únicamente para servidores locales" });

export const embedUrlSchema = playableUrl.refine(
  (u) => {
    try {
      const host = new URL(u).hostname;
      return (EMBED_ALLOWLIST as readonly string[]).includes(host);
    } catch {
      return false;
    }
  },
  { message: "Dominio de embed no permitido" },
);

export const mediaUrlSchema = playableUrl;

export const streamSourceSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["youtube", "youtube_live", "embed", "iframe", "mp4", "mp3", "hls", "obs_hls"]),
    url: z.string().url().optional(),
    embedUrl: z.string().url().optional(),
    title: z.string().min(1).max(160),
    isExternal: z.boolean(),
    requiresConsent: z.boolean().optional(),
    provider: z.enum(["youtube", "tiktok", "vimeo", "custom"]).optional(),
  })
  .superRefine((src, ctx) => {
    if (["hls", "mp4", "mp3"].includes(src.type)) {
      const parsed = mediaUrlSchema.safeParse(src.url);
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL inválida", path: ["url"] });
      return;
    }

    if (src.type === "obs_hls") {
      if (src.url) {
        const parsed = mediaUrlSchema.safeParse(src.url);
        if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL inválida", path: ["url"] });
      }
      return;
    }

    const parsed = embedUrlSchema.safeParse(src.embedUrl);
    if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL inválida", path: ["embedUrl"] });
  });

export type StreamSourceInput = z.infer<typeof streamSourceSchema>;

export function isEmbedAllowed(url: string | undefined): boolean {
  if (!url) return false;
  return embedUrlSchema.safeParse(url).success;
}
export function isMediaAllowed(url: string | undefined): boolean {
  if (!url) return false;
  return mediaUrlSchema.safeParse(url).success;
}
