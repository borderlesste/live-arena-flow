import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

function addUtcDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

async function enableAdminBypass(page: Page) {
  const adminProfile = {
    id: "qa-admin-id",
    email: "admin@example.com",
    displayName: "QA Admin",
    role: "admin",
    accountStatus: "active",
    createdAt: new Date().toISOString(),
    preferences: { matchReminders: false },
  };
  await page.route("**/api/profile", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(adminProfile),
  }));
  await page.route("**/auth/v1/**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ user: { id: adminProfile.id, email: adminProfile.email, created_at: adminProfile.createdAt, user_metadata: { display_name: adminProfile.displayName } } }),
  }));
  await page.route("**/rest/v1/profiles*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ id: adminProfile.id, display_name: adminProfile.displayName, account_status: "active", preferences: adminProfile.preferences, created_at: adminProfile.createdAt }]),
  }));
  await page.route("**/rest/v1/user_roles*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ user_id: adminProfile.id, role: "admin" }]),
  }));
  await page.addInitScript(() => localStorage.setItem("arena-live:session-token", "qa-admin-token"));
}

test("serves the public application and API through Next.js", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Luis Romero Fútbol/i);
  await expect(page.getByRole("heading", { name: /estamos afinando la cancha/i })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ ok: true, service: "luis-romero-futbol-api" });
});

test("keeps profile login available during maintenance", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: /accede a tu perfil/i })).toBeVisible();
});

test("wraps unauthenticated admin routes with maintenance", async ({ page }) => {
  await page.goto("/admin/streams");
  await expect(page).toHaveURL(/\/admin\/streams$/);
  await expect(page.getByRole("heading", { name: /estamos afinando la cancha/i })).toBeVisible();
});

test("lets administrators bypass maintenance", async ({ page }) => {
  await enableAdminBypass(page);
  await page.route("**/api/sports/events*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [] }) }));
  await page.route("**/api/sports/live*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [] }) }));
  await page.route("**/api/video-sources", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/live-sources", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/live-sources/status*", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/brand*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ platformName: "Luis Romero Fútbol" }) }));
  await page.goto("/admin/streams");
  await expect(page.getByRole("heading", { name: /fuentes de transmisión/i })).toBeVisible({ timeout: 10_000 });
});

test("keeps every planned admin route mounted and protected", async ({ page }) => {
  for (const route of ["/admin/dashboard", "/admin/matches", "/admin/users", "/admin/chat", "/admin/analytics", "/admin/settings", "/admin/audit"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole("heading", { name: /estamos afinando la cancha/i })).toBeVisible();
  }
});

test("renders API matches when status filters change", async ({ page }) => {
  await enableAdminBypass(page);
  await page.route("**/api/sports/events?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const date = params.get("date") ?? addUtcDays(params.get("start") ?? "2026-06-20", 1);
    const finished = true;
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
  await enableAdminBypass(page);
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

test("keeps public sports routes consistent and loads the complete World Cup range", async ({ page }) => {
  await enableAdminBypass(page);
  await page.route("**/api/sports/events?*", async (route) => {
    const url = new URL(route.request().url());
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const isWorldRange = start === "2026-06-11" && end === "2026-07-19";
    const date = url.searchParams.get("date") ?? addUtcDays(start ?? "2026-07-09", 1);
    const events = isWorldRange ? [
      {
        id: "world-group", startsAt: "2026-06-11T19:00:00.000Z", sport: "Football",
        competition: { id: "sportsrc-competition-world-cup", name: "World Championship", region: "World" },
        homeTeam: { id: "world-home", name: "México" }, awayTeam: { id: "world-away", name: "Sudáfrica" },
        homeScore: 1, awayScore: 0, status: "finished", phase: "Group Stage", group: "A", venue: "Estadio Ciudad de México",
      },
      {
        id: "world-final", startsAt: "2026-07-19T19:00:00.000Z", sport: "Football",
        competition: { id: "sportsrc-competition-world-cup", name: "World Championship", region: "World" },
        homeTeam: { id: "final-home", name: "Finalista A" }, awayTeam: { id: "final-away", name: "Finalista B" },
        homeScore: 0, awayScore: 0, status: "scheduled", phase: "Final", venue: "New York New Jersey Stadium",
      },
      {
        id: "other-cup", startsAt: "2026-06-11T21:00:00.000Z", sport: "Football",
        competition: { id: "other-league", name: "Otra Copa", region: "Local" },
        homeTeam: { id: "other-home", name: "Equipo ajeno" }, awayTeam: { id: "other-away", name: "Rival ajeno" },
        homeScore: 0, awayScore: 0, status: "scheduled",
      },
    ] : [
      {
        id: `finished-${date}`, startsAt: `${date}T12:00:00.000Z`, sport: "Football",
        competition: { id: "league-e2e", name: "Liga E2E", region: "Brasil" },
        homeTeam: { id: "finished-home", name: "Equipo Finalizado" }, awayTeam: { id: "finished-away", name: "Rival Finalizado" },
        homeScore: 2, awayScore: 1, status: "finished",
      },
      {
        id: `scheduled-${date}`, startsAt: `${date}T18:00:00.000Z`, sport: "Football",
        competition: { id: "league-e2e", name: "Liga E2E", region: "Brasil" },
        homeTeam: { id: "scheduled-home", name: "Equipo Futuro" }, awayTeam: { id: "scheduled-away", name: "Rival Futuro" },
        homeScore: 0, awayScore: 0, status: "scheduled",
      },
    ];
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events }) });
  });
  await page.route("**/api/video-sources", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));

  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "Partidos", exact: true })).toBeVisible();
  await expect(page.getByText("Equipo Futuro").first()).toBeVisible();

  await page.goto("/competitions");
  await expect(page.getByRole("heading", { name: "Competiciones", exact: true })).toBeVisible();
  await expect(page.getByText("Liga E2E").first()).toBeVisible();

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendario", exact: true })).toBeVisible();
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();

  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "Resultados", exact: true })).toBeVisible();
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Equipo Futuro")).toHaveCount(0);

  await page.goto("/mundial");
  await expect(page.getByRole("heading", { name: "World Championship", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fase de grupos", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final", exact: true })).toBeVisible();
  await expect(page.getByText("México").first()).toBeVisible();
  await expect(page.getByText("Equipo ajeno")).toHaveCount(0);
});

test("keeps mobile player overlays outside the consent controls", async ({ page }) => {
  await enableAdminBypass(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sports/events?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const date = params.get("date") ?? addUtcDays(params.get("start") ?? "2026-06-20", 1);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "e2e", events: [{
      id: "responsive-event", startsAt: `${date}T12:00:00.000Z`, sport: "Soccer",
      competition: { id: "responsive-league", name: "Liga responsive de prueba" },
      homeTeam: { id: "responsive-home", name: "Equipo Local" }, awayTeam: { id: "responsive-away", name: "Equipo Visitante" },
      homeScore: 0, awayScore: 0, status: "scheduled",
    }] }) });
  });
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
