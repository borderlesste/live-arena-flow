import { z } from "zod";

export const MAX_PERSISTED_IMAGE_BYTES = 512 * 1024;
export const MAX_PERSISTED_IMAGE_DATA_URL_LENGTH = 700_000;
export const PERSISTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const persistedImageSchema = z.string()
  .max(MAX_PERSISTED_IMAGE_DATA_URL_LENGTH, "La imagen supera el tamaño permitido")
  .regex(IMAGE_DATA_URL_PATTERN, "La imagen debe ser JPG, PNG o WebP en base64");

export const optionalPersistedImageSchema = persistedImageSchema.optional();
