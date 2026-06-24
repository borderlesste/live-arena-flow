// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getMatchReminderDelay, MATCH_REMINDER_LEAD_MS, MAX_TIMER_DELAY_MS } from "./match-reminders.service";

describe("match reminders", () => {
  const now = new Date("2026-06-21T12:00:00.000Z").getTime();

  it("schedules a reminder ten minutes before kickoff", () => {
    expect(getMatchReminderDelay("2026-06-21T12:30:00.000Z", now)).toBe(20 * 60_000);
  });

  it("notifies immediately when kickoff is less than ten minutes away", () => {
    expect(getMatchReminderDelay("2026-06-21T12:05:00.000Z", now)).toBe(0);
  });

  it("does not schedule past, invalid, or timer-unsafe dates", () => {
    expect(getMatchReminderDelay("2026-06-21T11:59:00.000Z", now)).toBeUndefined();
    expect(getMatchReminderDelay("invalid", now)).toBeUndefined();
    expect(getMatchReminderDelay(new Date(now + MATCH_REMINDER_LEAD_MS + MAX_TIMER_DELAY_MS + 1).toISOString(), now)).toBeUndefined();
  });
});
