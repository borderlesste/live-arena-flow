import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const enabled = process.env.QA_LIVE_SUPABASE === "true" && Boolean(supabaseUrl && anonKey && serviceRoleKey);

test.describe("persistencia real de usuario", () => {
  test.skip(!enabled, "Requiere QA_LIVE_SUPABASE=true y credenciales Supabase completas");

  test("perfil, seguir y chat sobreviven al recorrido UI → Supabase", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    const runId = randomUUID();
    const email = `qa.browser.${runId}@example.invalid`;
    const password = `Qa-${randomUUID()}-9a!`;
    const initialName = `QA Browser ${runId.slice(0, 8)}`;
    const updatedName = `${initialName} Updated`;
    const chatBody = `QA browser persistence ${runId}`;
    const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    let userId: string | undefined;

    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: initialName },
      });
      if (createError) throw createError;
      userId = created.user.id;

      await page.goto("/profile");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: "Iniciar sesión", exact: true }).last().click();
      await expect(page.getByRole("heading", { name: initialName }), browserErrors.join("\n")).toBeVisible({ timeout: 15_000 });

      const profileForm = page.locator("form").filter({ hasText: "Información personal" });
      await profileForm.locator("input").first().fill(updatedName);
      await profileForm.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

      await page.goto("/");
      const followButton = page.getByRole("button", { name: "Seguir", exact: true }).first();
      await expect(followButton, browserErrors.join("\n")).toBeVisible({ timeout: 15_000 });
      await followButton.click();
      await expect(page.getByRole("button", { name: "Siguiendo", exact: true }).first()).toBeVisible();

      await page.getByRole("textbox", { name: "Mensaje del chat" }).fill(chatBody);
      await page.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(page.getByText(chatBody)).toBeVisible();

      const [{ data: profile }, { data: favorites }, { data: messages }] = await Promise.all([
        admin.from("profiles").select("display_name").eq("id", userId).single(),
        admin.from("user_favorite_matches").select("external_match_id").eq("user_id", userId),
        admin.from("chat_messages").select("body").eq("user_id", userId).eq("body", chatBody),
      ]);
      expect(profile?.display_name).toBe(updatedName);
      expect(favorites?.length).toBeGreaterThan(0);
      expect(messages?.map((message) => message.body)).toContain(chatBody);
    } finally {
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
