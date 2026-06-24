import { expect, test } from "@playwright/test";

test("serves the public application and API through Next.js", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Luis Romero Fútbol/i);
  await expect(page.locator("body")).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ ok: true, service: "luis-romero-futbol-api" });
});

test("keeps the canonical stream administration route available", async ({ page }) => {
  await page.goto("/admin/streams");
  await expect(page).toHaveURL(/\/admin\/streams$/);
  await expect(page.getByText(/Inicia sesi/i)).toBeVisible();
});

test("protects the sponsor administration route", async ({ page }) => {
  await page.goto("/admin/sponsors");
  await expect(page).toHaveURL(/\/admin\/sponsors$/);
  await expect(page.getByText(/Inicia sesi/i)).toBeVisible();
});

test("keeps every planned admin route mounted and protected", async ({ page }) => {
  for (const route of ["/admin/dashboard", "/admin/matches", "/admin/users", "/admin/chat", "/admin/analytics", "/admin/settings", "/admin/audit"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByText(/Inicia sesi/i)).toBeVisible();
  }
});

test("renders API matches when status filters change", async ({ page }) => {
  await page.route("**/api/sports/events?*", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-06-21";
    const finished = date.endsWith("20");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ provider: "e2e", events: [{
        id: `event-${date}`,
        startsAt: `${date}T12:00:00.000Z`,
        sport: "Soccer",
        competition: { id: "league-e2e", name: "Liga E2E" },
        homeTeam: { id: "home-e2e", name: "Equipo API Local" },
        awayTeam: { id: "away-e2e", name: "Equipo API Visitante" },
        homeScore: finished ? 2 : 0,
        awayScore: finished ? 1 : 0,
        status: finished ? "finished" : "scheduled",
      }] }),
    });
  });
  await page.route("**/api/video-sources", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));

  await page.goto("/");
  await page.getByRole("tab", { name: "Finalizados" }).click();
  await expect(page.getByRole("heading", { name: "Resultados recientes", exact: true })).toBeVisible();
  await expect(page.getByText("Equipo API Local").first()).toBeVisible();
});

test("renders live matches from the dedicated live sports API", async ({ page }) => {
  await page.route("**/api/sports/live", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [{
    id: "live-event",
    startsAt: "2026-06-21T12:00:00.000Z",
    sport: "Soccer",
    competition: { id: "live-league", name: "Liga Live E2E" },
    homeTeam: { id: "live-home", name: "Equipo En Vivo" },
    awayTeam: { id: "live-away", name: "Rival Directo" },
    homeScore: 1,
    awayScore: 0,
    status: "live",
    statusLabel: "55'",
  }] }) }));
  await page.route("**/api/video-sources", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([{
    id: "live-source", matchId: "live-event", createdAt: "2026-06-21T10:00:00.000Z",
    type: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/live123", title: "Fuente live",
    isExternal: true, requiresConsent: true, provider: "youtube", purpose: "live",
  }]) }));

  await page.goto("/live");
  await expect(page.getByRole("heading", { name: "Transmisiones en vivo" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Liga Live E2E").first()).toBeVisible();
  await expect(page.getByText("EQU").first()).toBeVisible();
  await expect(page.getByText("55'").first()).toBeVisible();
});

test("keeps mobile player overlays outside the consent controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sports/events?*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [{
    id: "responsive-event", startsAt: "2026-06-21T12:00:00.000Z", sport: "Soccer",
    competition: { id: "responsive-league", name: "Liga responsive de prueba" },
    homeTeam: { id: "responsive-home", name: "Equipo Local" }, awayTeam: { id: "responsive-away", name: "Equipo Visitante" },
    homeScore: 0, awayScore: 0, status: "scheduled",
  }] }) }));
  await page.route("**/api/video-sources", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify([{
    id: "responsive-source", matchId: "responsive-event", createdAt: "2026-06-21T10:00:00.000Z",
    type: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/abc123", title: "Fuente responsive",
    isExternal: true, requiresConsent: true, provider: "youtube", purpose: "live",
  }]) }));
  await page.goto("/");
  const scoreboard = await page.getByTestId("player-scoreboard").boundingBox();
  const consent = await page.getByTestId("embed-consent-content").boundingBox();
  const controls = await page.getByTestId("player-controls").boundingBox();
  expect(scoreboard && consent && scoreboard.y + scoreboard.height <= consent.y).toBe(true);
  expect(consent && controls && consent.y + consent.height <= controls.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
