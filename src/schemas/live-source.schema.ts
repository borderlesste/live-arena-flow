import { z } from "zod";

const publicPlaybackUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
}, "La URL pública debe usar HTTPS");

export const liveSourceStatusSchema = z.enum([
  "provisioning",
  "waiting_signal",
  "ready",
  "connecting",
  "live",
  "reconnecting",
  "disconnected",
  "disabled",
  "provision_failed",
  "provider_error",
  "deletion_pending",
  "deletion_failed",
  "deleted",
]);

export type LiveSourceStatus = z.infer<typeof liveSourceStatusSchema>;

export const obsIngestModeSchema = z.enum(["configured", "direct_cloudflare"]);

export type ObsIngestMode = z.infer<typeof obsIngestModeSchema>;

export const streamCredentialsSchema = z.object({
  ingestUrl: z.string().min(1),
  ingestProtocol: z.enum(["rtmp", "rtmps", "srt"]),
  streamKey: z.string().min(1),
});

export type StreamCredentials = z.infer<typeof streamCredentialsSchema>;

export const createLiveSourceSchema = z.object({
  matchId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(100),
  sourceKind: z.enum(["manual", "obs"]),
  usageType: z.enum(["live", "highlight", "prerecorded"]),
  playbackFormat: z.string().trim().min(1).max(32).optional(),
  playbackUrl: publicPlaybackUrlSchema.optional(),
  coverImageUrl: z.string().url().refine((value) => new URL(value).protocol === "https:", "La URL de la portada debe usar HTTPS").optional(),
  ingestProtocol: z.enum(["rtmp", "rtmps", "srt"]).optional(),
  ingestMode: obsIngestModeSchema.optional(),
  recordingEnabled: z.boolean().optional(),
  lowLatencyEnabled: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.sourceKind === "manual" && !value.playbackUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["playbackUrl"], message: "URL de reproducción requerida" });
  }
  if (value.sourceKind === "manual" && value.ingestMode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ingestMode"], message: "La ruta de ingesta solo aplica a fuentes OBS" });
  }
});

export type CreateLiveSourceInput = z.infer<typeof createLiveSourceSchema>;

export const updateLiveSourceSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  matchId: z.string().trim().min(1).max(160).optional(),
  coverImageUrl: z.string().url().refine((value) => new URL(value).protocol === "https:", "La URL de la portada debe usar HTTPS").optional(),
  isPrimary: z.boolean().optional(),
  lowLatencyEnabled: z.boolean().optional(),
  recordingEnabled: z.boolean().optional(),
  playbackUrl: publicPlaybackUrlSchema.optional(),
}).strict();

export const cloudflareLiveWebhookSchema = z.object({
  data: z.object({
    input_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    event_type: z.enum(["live_input.connected", "live_input.disconnected", "live_input.errored"]),
    updated_at: z.string().datetime(),
    error_code: z.string().trim().regex(/^[a-zA-Z0-9_.:-]{1,120}$/).optional(),
  }),
  ts: z.number().optional(),
}).passthrough();

export const createLiveSourceResponseSchema = z.object({
  source: z.record(z.unknown()),
  credentials: streamCredentialsSchema.optional(),
  relayDestination: streamCredentialsSchema.optional(),
  replayed: z.boolean(),
});

export type CreateLiveSourceResponse<TSource = Record<string, unknown>> = {
  source: TSource;
  credentials?: StreamCredentials;
  relayDestination?: StreamCredentials;
  replayed: boolean;
};
