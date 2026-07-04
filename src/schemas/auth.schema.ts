import { z } from "zod";

const HTML_DELIMITERS = /[<>]/u;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

export const authEmailSchema = z.string()
  .trim()
  .min(1, "Introduce tu correo electrónico")
  .max(160, "El correo no puede superar 160 caracteres")
  .email("Introduce un correo electrónico válido")
  .transform((value) => value.toLowerCase());

export const authPasswordSchema = z.string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede superar 128 caracteres")
  .refine((value) => !containsControlCharacter(value), "La contraseña contiene caracteres de control no permitidos");

export const displayNameSchema = z.string()
  .trim()
  .min(2, "El nombre visible debe tener al menos 2 caracteres")
  .max(40, "El nombre visible no puede superar 40 caracteres")
  .refine((value) => !containsControlCharacter(value), "El nombre visible contiene caracteres de control no permitidos")
  .refine((value) => !HTML_DELIMITERS.test(value), "El nombre visible no puede contener < ni >")
  .transform((value) => value.normalize("NFKC"));

export const authCredentialsSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
}).strict();

export const authRegistrationSchema = authCredentialsSchema.extend({
  displayName: displayNameSchema,
}).strict();

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthRegistration = z.infer<typeof authRegistrationSchema>;

export function displayNameKey(value: string): string {
  return displayNameSchema.parse(value).toLocaleLowerCase("es");
}
