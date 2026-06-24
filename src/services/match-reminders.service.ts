import type { NormalizedSportsEvent } from "@/schemas/sports-event.schema";

export const MATCH_REMINDER_LEAD_MS = 10 * 60_000;
export const MAX_TIMER_DELAY_MS = 2_147_000_000;

export function getMatchReminderDelay(startsAt: string, now = Date.now()): number | undefined {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start) || start <= now) return undefined;
  const delay = Math.max(0, start - now - MATCH_REMINDER_LEAD_MS);
  return delay <= MAX_TIMER_DELAY_MS ? delay : undefined;
}

export function showMatchReminder(event: NormalizedSportsEvent): Notification {
  const notification = new Notification("Partido por comenzar", {
    body: `${event.homeTeam.name} vs ${event.awayTeam.name} comienza en menos de 10 minutos.`,
    icon: "/brand/symbols/symbol-green-dark.png",
    tag: `match-reminder-${event.id}`,
  });
  notification.onclick = () => {
    window.focus();
    window.location.assign(`/match/${event.id}`);
    notification.close();
  };
  return notification;
}
