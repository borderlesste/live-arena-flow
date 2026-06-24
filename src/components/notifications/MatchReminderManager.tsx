import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteMatchEvents } from "@/hooks/useFavoriteMatch";
import { getMatchReminderDelay, showMatchReminder } from "@/services/match-reminders.service";

const STORAGE_PREFIX = "arena-live:reminder:";

export function MatchReminderManager() {
  const auth = useAuth();
  const followedMatches = useFavoriteMatchEvents();

  useEffect(() => {
    if (!auth.profile?.preferences.matchReminders || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const timers: number[] = [];

    for (const { event } of followedMatches.data ?? []) {
      if (!event) continue;
      const storageKey = `${STORAGE_PREFIX}${event.id}:${event.startsAt}`;
      if (sessionStorage.getItem(storageKey)) continue;
      const delay = getMatchReminderDelay(event.startsAt);
      if (delay === undefined) continue;
      timers.push(window.setTimeout(() => {
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, new Date().toISOString());
        showMatchReminder(event);
      }, delay));
    }

    return () => timers.forEach(window.clearTimeout);
  }, [auth.profile?.preferences.matchReminders, followedMatches.data]);

  return null;
}
