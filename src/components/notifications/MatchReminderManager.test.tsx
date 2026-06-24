import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchReminderManager } from "./MatchReminderManager";

const notificationConstructor = vi.fn();
const startsAt = "2026-06-21T12:05:00.000Z";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ profile: { preferences: { matchReminders: true } } }),
}));

vi.mock("@/hooks/useFavoriteMatch", () => ({
  useFavoriteMatchEvents: () => ({
    data: [{
      id: "event-1",
      event: {
        id: "event-1",
        startsAt,
        sport: "Soccer",
        competition: { id: "league-1", name: "League" },
        homeTeam: { id: "home", name: "Home" },
        awayTeam: { id: "away", name: "Away" },
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
      },
    }],
  }),
}));

class MockNotification {
  static permission: NotificationPermission = "granted";
  onclick: ((this: Notification, ev: Event) => unknown) | null = null;
  close = vi.fn();

  constructor(title: string, options?: NotificationOptions) {
    notificationConstructor(title, options);
  }
}

describe("MatchReminderManager", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    notificationConstructor.mockClear();
    sessionStorage.clear();
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: MockNotification });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    vi.useRealTimers();
  });

  it("creates one browser notification for a followed match near kickoff", () => {
    act(() => root.render(<MatchReminderManager />));
    act(() => vi.runOnlyPendingTimers());

    expect(notificationConstructor).toHaveBeenCalledOnce();
    expect(notificationConstructor).toHaveBeenCalledWith("Partido por comenzar", expect.objectContaining({
      body: "Home vs Away comienza en menos de 10 minutos.",
      tag: "match-reminder-event-1",
    }));
    expect(sessionStorage.getItem(`arena-live:reminder:event-1:${startsAt}`)).toBeTruthy();
  });
});
