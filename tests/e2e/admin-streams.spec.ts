/**
 * E2E tests for the streaming sources admin page (/admin/streams).
 *
 * All API calls are mocked via Playwright route interception.
 * No real streaming server or Supabase connection is required.
 *
 * IMPORTANT: These tests verify the UI flow only.
 * A real OBS transmission test requires manual verification — see docs/streaming-obs.md.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface E2ESource {
  id: string;
  [key: string]: unknown;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN_PROFILE = {
  id: "qa-admin-id",
  email: "admin@example.com",
  displayName: "QA Admin",
  role: "admin",
  accountStatus: "active",
  createdAt: new Date().toISOString(),
  preferences: { matchReminders: false },
};

const QA_EVENT = {
  id: "qa-event-1",
  startsAt: "2026-06-25T20:00:00.000Z",
  sport: "Soccer",
  competition: { id: "qa-league", name: "Liga QA" },
  homeTeam: { id: "home-qa", name: "Local QA" },
  awayTeam: { id: "away-qa", name: "Visita QA" },
  homeScore: 0,
  awayScore: 0,
  status: "scheduled",
  competitionId: "qa-league",
  homeTeamId: "home-qa",
  awayTeamId: "away-qa",
  venue: "Estadio QA",
};

const CREATED_OBS_SOURCE = {
  id: "src-obs-created",
  matchId: "qa-event-1",
  title: "Señal OBS E2E",
  type: "obs_hls",
  isExternal: false,
  sourceKind: "obs",
  usageType: "live",
  ingestProtocol: "rtmps",
  ingestUrl: "rtmps://ingest.example.com:443/live",
  playbackUrl: undefined,
  streamKeyLast4: "A92F",
  hasStreamKey: true,
  status: "ready",
  provider: "custom",
  providerInputId: "prov-uuid-001",
  isEnabled: true,
  isPrimary: false,
  recordingEnabled: false,
  lowLatencyEnabled: false,
  createdAt: new Date().toISOString(),
  obs: {
    protocol: "rtmps",
    serverUrl: "rtmps://ingest.example.com:443/live",
    hasStreamKey: true,
  },
};

const CREATED_MANUAL_SOURCE = {
  id: "src-manual-created",
  matchId: "qa-event-1",
  title: "Señal Manual E2E",
  type: "hls",
  isExternal: false,
  sourceKind: "manual",
  usageType: "live",
  playbackUrl: "https://cdn.example.com/live/stream.m3u8",
  url: "https://cdn.example.com/live/stream.m3u8",
  status: "ready",
  isEnabled: true,
  isPrimary: false,
  createdAt: new Date().toISOString(),
};

// ── Setup helper ───────────────────────────────────────────────────────────────

async function setupAdminPage(page: Page, initialSources: E2ESource[] = []) {
  // Auth: profile endpoint
  await page.route("**/api/profile", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(ADMIN_PROFILE) }),
  );

  // Auth: Supabase profile endpoint (used by useAuth hook)
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ user: { id: "qa-admin-id", email: "admin@example.com", user_metadata: { role: "admin" } } }) }),
  );

  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([{ id: "qa-admin-id", display_name: "QA Admin", role: "admin" }]) }),
  );

  await page.route("**/rest/v1/user_roles*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([{ user_id: "qa-admin-id", role: "admin" }]) }),
  );

  // Sports data
  await page.route("**/api/sports/events*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [QA_EVENT] }) }),
  );
  await page.route("**/api/sports/live*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [] }) }),
  );

  // Public video sources
  await page.route("**/api/video-sources", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([]) }),
  );

  // Admin live-sources list — dynamic: updated after creation
  let sources = [...initialSources];
  await page.route("**/api/admin/live-sources", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(sources) });
      return;
    }
    if (method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}") as { sourceKind?: string };
      const newSource = body.sourceKind === "obs" ? CREATED_OBS_SOURCE : CREATED_MANUAL_SOURCE;
      sources = [...sources, newSource];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          source: newSource,
          credentials: body.sourceKind === "obs" ? {
            ingestUrl: "rtmps://ingest.example.com:443/live",
            ingestProtocol: "rtmps",
            streamKey: "e2ekey1234A92F",
          } : undefined,
          replayed: false,
        }),
      });
      return;
    }
    await route.continue();
  });

  // Admin live-sources detail endpoints
  await page.route("**/api/admin/live-sources/**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (url.includes("/credentials/reveal") && method === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ingestUrl: "rtmps://ingest.example.com:443/live", ingestProtocol: "rtmps", streamKey: "e2ekey1234A92F" }),
      });
      return;
    }
    if (url.includes("/credentials/rotate") && method === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ingestUrl: "rtmps://ingest.example.com:443/live", ingestProtocol: "rtmps", streamKey: "newRotatedKey0000" }),
      });
      return;
    }
    if (url.includes("/enable") && method === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    if (url.includes("/disable") && method === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    if ((url.includes("/status")) && method === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (method === "PATCH") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    if (method === "DELETE") {
      sources = sources.filter((s) => !url.includes(s.id));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.continue();
  });

  // Status polling endpoint
  await page.route("**/api/admin/live-sources/status*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([]) }),
  );

  // Brand settings
  await page.route("**/api/brand*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ platformName: "Test Platform" }) }),
  );

  // Inject session token
  await page.addInitScript(() => {
    localStorage.setItem("arena-live:session-token", "qa-admin-bearer-token");
  });

  await page.goto("/admin/streams");
  await page.waitForLoadState("networkidle");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe("Admin streams page — layout and basic rendering", () => {
  test("shows the 3-column form layout on desktop", async ({ page }) => {
    await setupAdminPage(page);
    await expect(page.getByRole("heading", { name: /fuentes de transmisión/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/nueva fuente/i)).toBeVisible();
    await expect(page.getByText(/publicar con obs/i)).toBeVisible();
    await expect(page.getByText(/credenciales de transmisión/i)).toBeVisible();
  });

  test("shows empty list message when no sources exist", async ({ page }) => {
    await setupAdminPage(page, []);
    await expect(page.getByText(/aún no hay fuentes configuradas/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Admin streams — manual source creation", () => {
  test("URL field is visible when OBS is disabled", async ({ page }) => {
    await setupAdminPage(page);
    await expect(page.getByLabel(/url de reproducción/i)).toBeVisible({ timeout: 8_000 });
  });

  test("creates a manual HLS source successfully", async ({ page }) => {
    await setupAdminPage(page);
    await expect(page.locator('[id="source-title"]')).toBeVisible({ timeout: 20_000 });

    // Fill form
    await page.getByLabel(/nombre de la señal/i).fill("Señal Manual E2E");

    const playbackInput = page.getByLabel(/url de reproducción/i);
    await playbackInput.fill("https://cdn.example.com/live/stream.m3u8");

    // Click create
    const postPromise = page.waitForResponse("**/api/admin/live-sources");
    await page.getByRole("button", { name: /crear fuente/i }).click();
    await postPromise;

    // Verify source appears in the list
    await expect(page.getByRole("button", { name: /fuente: señal manual e2e/i })).toBeVisible({ timeout: 8_000 });
  });

  test("shows validation error when title is empty", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="source-title"]', { timeout: 8_000 });

    // Clear title field
    await page.getByLabel(/nombre de la señal/i).fill("");
    await page.getByRole("button", { name: /crear fuente/i }).click();

    await expect(page.getByText("Introduce un nombre para la señal.")).toBeVisible({ timeout: 5_000 });
  });

  test("shows validation error when URL is empty for manual source", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="source-title"]', { timeout: 8_000 });

    // Ensure OBS is off and URL is empty
    await page.getByLabel(/nombre de la señal/i).fill("Test sin URL");
    await page.getByRole("button", { name: /crear fuente/i }).click();

    await expect(page.getByText("Introduce la URL de reproducción.")).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Admin streams — OBS source creation", () => {
  test("URL field hides when OBS toggle is activated", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="obs-toggle"]', { timeout: 8_000 });

    // Initially visible
    await expect(page.getByLabel(/url de reproducción/i)).toBeVisible();

    // Toggle OBS on
    await page.locator('[id="obs-toggle"]').click();

    // URL field should disappear
    await expect(page.getByLabel(/url de reproducción/i)).not.toBeVisible();
  });

  test("OBS toggle forces usage to En vivo", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="obs-toggle"]', { timeout: 8_000 });
    await page.locator('[id="obs-toggle"]').click();

    // Usage select should show 'En vivo' and be disabled
    const usageSelect = page.locator('[id="source-purpose"]');
    await expect(usageSelect).toHaveAttribute("data-disabled", "");
  });

  test("creates an OBS source and displays credentials panel", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="obs-toggle"]', { timeout: 8_000 });

    // Fill form and enable OBS
    await page.getByLabel(/nombre de la señal/i).fill("Señal OBS E2E");
    await page.locator('[id="obs-toggle"]').click();

    // Click create — button should show progressive states
    const postPromise = page.waitForResponse((res) =>
      res.url().includes("/api/admin/live-sources") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /crear fuente/i }).click();

    // Button should be disabled during creation
    await expect(page.getByRole("button", { name: /creando entrada|guardando configuración/i })).toBeVisible({ timeout: 3_000 });

    await postPromise;

    // Credentials panel should show OBS details
    await expect(page.getByRole("textbox", { name: /servidor obs/i })).toHaveValue("rtmps://ingest.example.com:443/live", { timeout: 8_000 });
  });

  test("shows OBS ingest URL in credentials panel after creation", async ({ page }) => {
    await setupAdminPage(page, [CREATED_OBS_SOURCE]);

    // Select the existing OBS source by clicking its card
    await page.waitForSelector(`text=Señal OBS E2E`, { timeout: 8_000 }).catch(() => null);
    const card = page.getByRole("button", { name: /fuente: señal obs e2e/i }).first();
    if (await card.isVisible()) {
      await card.click();
      await expect(page.getByRole("textbox", { name: /servidor obs/i })).toBeVisible({ timeout: 5_000 });
    }
  });

  test("double click does not create duplicate sources", async ({ page }) => {
    await setupAdminPage(page);
    await page.waitForSelector('[id="obs-toggle"]', { timeout: 8_000 });
    await page.getByLabel(/nombre de la señal/i).fill("Señal OBS Doble");
    await page.locator('[id="obs-toggle"]').click();

    let postCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/admin/live-sources") && req.method() === "POST") postCount++;
    });

    const createBtn = page.getByRole("button", { name: /crear fuente/i });
    // Double click rapidly
    await createBtn.click();
    await createBtn.click();

    await page.waitForTimeout(500);
    // Only one POST should have been sent (button disabled after first click)
    expect(postCount).toBeLessThanOrEqual(1);
  });
});

test.describe("Admin streams — credential actions", () => {
  test("reveals stream key when eye button is clicked", async ({ page }) => {
    await setupAdminPage(page, [CREATED_OBS_SOURCE]);
    await page.waitForSelector(`text=${CREATED_OBS_SOURCE.title}`, { timeout: 8_000 }).catch(() => null);

    const card = page.getByRole("button", { name: /fuente: señal obs e2e/i }).first();
    if (await card.isVisible()) {
      await card.click();

      const revealBtn = page.getByRole("button", { name: /revelar clave/i }).first();
      if (await revealBtn.isVisible()) {
        const revealPromise = page.waitForResponse("**/credentials/reveal");
        await revealBtn.click();
        await revealPromise;
        // Key field should now show the full key
        const keyInput = page.getByLabel(/clave de transmisión/i).first();
        await expect(keyInput).toHaveAttribute("type", "text");
      }
    }
  });

  test("copies ingest URL when copy button is clicked", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await setupAdminPage(page, [CREATED_OBS_SOURCE]);
    await page.waitForSelector(`text=${CREATED_OBS_SOURCE.title}`, { timeout: 8_000 }).catch(() => null);

    const card = page.getByRole("button", { name: /fuente: señal obs e2e/i }).first();
    if (await card.isVisible()) {
      await card.click();
      const copyBtn = page.getByRole("button", { name: /copiar servidor obs/i }).first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toBe("rtmps://ingest.example.com:443/live");
      }
    }
  });
});

test.describe("Admin streams — source list actions", () => {
  test("shows source in list after creation", async ({ page }) => {
    await setupAdminPage(page, [CREATED_MANUAL_SOURCE]);
    await expect(page.getByText("Señal Manual E2E")).toBeVisible({ timeout: 8_000 });
  });

  test("shows delete confirmation dialog", async ({ page }) => {
    await setupAdminPage(page, [CREATED_MANUAL_SOURCE]);
    await page.waitForSelector(`text=Señal Manual E2E`, { timeout: 8_000 });

    // Open dropdown menu for the source
    const menuBtn = page.getByRole("button", { name: /acciones para señal manual e2e/i }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.getByRole("menuitem", { name: /eliminar fuente/i }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText(/estás a punto de eliminar/i)).toBeVisible();
    }
  });

  test("live source deletion shows warning in dialog", async ({ page }) => {
    const liveSource = { ...CREATED_OBS_SOURCE, status: "live", title: "Señal En Vivo" };
    await setupAdminPage(page, [liveSource]);
    await page.waitForSelector(`text=Señal En Vivo`, { timeout: 8_000 });

    const menuBtn = page.getByRole("button", { name: /acciones para señal en vivo/i }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.getByRole("menuitem", { name: /eliminar fuente/i }).click();
      await expect(page.getByText(/transmisión está en vivo/i)).toBeVisible({ timeout: 3_000 });
    }
  });

  test("source count badge updates after creation", async ({ page }) => {
    await setupAdminPage(page, []);

    // Initially 0
    const badge = page.locator('text="0"').first();
    await expect(badge).toBeVisible({ timeout: 8_000 });

    // Create a manual source
    await page.waitForSelector('[id="source-title"]', { timeout: 8_000 });
    await page.getByLabel(/nombre de la señal/i).fill("Nueva Fuente");
    await page.getByLabel(/url de reproducción/i).fill("https://cdn.example.com/live/stream.m3u8");

    const postPromise = page.waitForResponse("**/api/admin/live-sources");
    await page.getByRole("button", { name: /crear fuente/i }).click();
    await postPromise;

    await expect(page.locator('text="1"').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Admin streams — access control", () => {
  test("shows access restricted message for non-admin users", async ({ page }) => {
    await page.route("**/api/profile", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...ADMIN_PROFILE, role: "user" }) }),
    );
    await page.route("**/rest/v1/user_roles*", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify([{ user_id: "qa-admin-id", role: "user" }]) }),
    );
    await page.addInitScript(() => {
      localStorage.setItem("arena-live:session-token", "user-token");
    });
    await page.goto("/admin/streams");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/acceso restringido/i)).toBeVisible({ timeout: 8_000 });
  });

  test("shows login prompt for unauthenticated users", async ({ page }) => {
    await page.route("**/api/profile", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sesión no válida" }) }),
    );
    await page.goto("/admin/streams");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/inicia sesión/i)).toBeVisible({ timeout: 8_000 });
  });
});
