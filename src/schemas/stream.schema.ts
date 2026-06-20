import { z } from "zod";

// Domains allowed for iframe embeds. Anything else is blocked at runtime.
export const EMBED_ALLOWLIST = [
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
  "player.vimeo.com",
  "www.tiktok.com",
] as const;

// Domains allowed for direct media (HLS / HTML5).
export const MEDIA_ALLOWLIST = [
  "test-streams.mux.dev",
  "stream.mux.com",
  "demo.unified-streaming.com",
  "commondatastorage.googleapis.com",
] as const;

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "Solo se permiten URLs https" });

export const embedUrlSchema = httpsUrl.refine(
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

export const mediaUrlSchema = httpsUrl.refine(
  (u) => {
    try {
      const host = new URL(u).hostname;
      return (MEDIA_ALLOWLIST as readonly string[]).includes(host);
    } catch {
      return false;
    }
  },
  { message: "Dominio de media no permitido" },
);

export const streamSourceSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["youtube", "tiktok", "hls", "webrtc", "html5", "iframe"]),
    url: z.string().url().optional(),
    embedUrl: z.string().url().optional(),
    title: z.string().min(1).max(160),
    isExternal: z.boolean(),
    requiresConsent: z.boolean().optional(),
    provider: z.enum(["youtube", "tiktok", "vimeo", "custom"]).optional(),
  })
  .superRefine((src, ctx) => {
    if (["hls", "html5", "webrtc"].includes(src.type)) {
      const parsed = mediaUrlSchema.safeParse(src.url);
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL inválida", path: ["url"] });
    } else {
      const parsed = embedUrlSchema.safeParse(src.embedUrl);
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "URL inválida", path: ["embedUrl"] });
    }
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
