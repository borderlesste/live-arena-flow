import {
  MAX_PERSISTED_IMAGE_BYTES,
  PERSISTED_IMAGE_MIME_TYPES,
  persistedImageSchema,
} from "@/schemas/image.schema";

const supportedTypes = new Set<string>(PERSISTED_IMAGE_MIME_TYPES);

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!supportedTypes.has(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WebP.");
  }
  if (file.size > MAX_PERSISTED_IMAGE_BYTES) {
    throw new Error("La imagen no puede superar 512 KB.");
  }

  const value = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });

  return persistedImageSchema.parse(value);
}
