import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const templates = ["confirmation.html", "recovery.html"] as const;

describe("Supabase Auth email templates", () => {
  for (const template of templates) {
    it(`${template} is branded, secure and UTF-8`, async () => {
      const html = await readFile(resolve("supabase", "email-templates", template), "utf8");

      expect(html).toContain('<html lang="es">');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain("Luis Romero Fútbol");
      expect(html).toContain("https://www.luisromerofutbol.com/brand/logos/logo-white.png");
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).not.toContain("mail.app.supabase.io");
      expect(html).not.toContain("powered by Supabase");
      expect(html).not.toMatch(/<script\b/i);
    });
  }
});
