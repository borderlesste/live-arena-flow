import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { Competition, Match } from "@/types";

export function formatMatchDate(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `Hoy · ${format(date, "HH:mm")}`;
  if (isTomorrow(date)) return `Mañana · ${format(date, "HH:mm")}`;
  if (isYesterday(date)) return `Ayer · ${format(date, "HH:mm")}`;
  return format(date, "d MMM · HH:mm", { locale: es });
}

export function formatRelativeShort(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es });
}

export function formatDayGroup(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getMatchTimestamp(match: Match): number | null {
  const fixture = (match as Match & { fixture?: Record<string, unknown> }).fixture;
  const candidates = [
    (match as Match & Record<string, unknown>).date,
    (match as Match & Record<string, unknown>).matchDate,
    (match as Match & Record<string, unknown>).startTime,
    (match as Match & Record<string, unknown>).kickoff,
    (match as Match & Record<string, unknown>).timestamp,
    (match as Match & Record<string, unknown>).utcDate,
    fixture && typeof fixture === "object" && fixture !== null ? fixture.date : undefined,
    match.startsAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" && typeof candidate !== "number") continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return null;
}

export function normalizeMatchDate(match: Match): { timestamp: number | null; dateLabel: string; sortKey: string } {
  const timestamp = getMatchTimestamp(match);
  if (timestamp === null) {
    return { timestamp: null, dateLabel: "Fecha por confirmar", sortKey: "9999-99-99" };
  }

  const date = new Date(timestamp);
  const dayStart = startOfDay(date).getTime();
  const normalized = new Date(date);
  const dayLabel = isToday(normalized) ? "Hoy" : isYesterday(normalized) ? "Ayer" : format(normalized, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  return {
    timestamp,
    dateLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
    sortKey: format(date, "yyyy-MM-dd"),
  };
}

export function sortMatchesByDateDesc(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const timestampA = getMatchTimestamp(a);
    const timestampB = getMatchTimestamp(b);

    if (timestampA === null && timestampB === null) return a.id.localeCompare(b.id);
    if (timestampA === null) return 1;
    if (timestampB === null) return -1;
    if (timestampA === timestampB) return a.id.localeCompare(b.id);
    return timestampB - timestampA;
  });
}

export function groupMatchesByDate(matches: Match[]): Array<{ key: string; label: string; matches: Match[] }> {
  const sorted = sortMatchesByDateDesc(matches);
  const groups = new Map<string, { key: string; label: string; matches: Match[] }>();

  sorted.forEach((match) => {
    const { dateLabel, sortKey, timestamp } = normalizeMatchDate(match);
    const key = timestamp === null ? "unconfirmed" : sortKey;
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(match);
      return;
    }

    groups.set(key, { key, label: timestamp === null ? "Fecha por confirmar" : dateLabel, matches: [match] });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === "unconfirmed") return 1;
    if (b.key === "unconfirmed") return -1;
    return b.key.localeCompare(a.key);
  });
}

function getCompetitionNextEventTimestamp(competition: Competition): number | null {
  const now = Date.now();
  const fixture = (competition as Competition & { fixture?: Record<string, unknown> }).fixture;
  const candidates = [
    (competition as Competition & Record<string, unknown>).nextEventDate,
    (competition as Competition & Record<string, unknown>).nextMatchDate,
    (competition as Competition & Record<string, unknown>).next_event,
    (competition as Competition & Record<string, unknown>).nextMatch,
    (competition as Competition & Record<string, unknown>).startTime,
    (competition as Competition & Record<string, unknown>).kickoff,
    (competition as Competition & Record<string, unknown>).timestamp,
    fixture && typeof fixture === "object" && fixture !== null ? fixture.date : undefined,
    competition.nextEventAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" && typeof candidate !== "number") continue;
    const parsed = new Date(candidate);
    const timestamp = parsed.getTime();
    if (Number.isNaN(timestamp) || timestamp <= now) continue;
    return timestamp;
  }

  return null;
}

export function sortCompetitionsByPriority(competitions: Competition[]): Competition[] {
  const normalized = competitions.map((competition, index) => {
    const activeMatches = Number((competition as Competition & Record<string, unknown>).activeMatches ?? 0);
    const nextEventTimestamp = getCompetitionNextEventTimestamp(competition);
    const hasValidDate = nextEventTimestamp !== null;

    return {
      competition,
      index,
      activeMatches: Number.isFinite(activeMatches) ? activeMatches : 0,
      nextEventTimestamp,
      hasValidDate,
    };
  });

  return normalized.sort((a, b) => {
    if (a.activeMatches > 0 && b.activeMatches === 0) return -1;
    if (a.activeMatches === 0 && b.activeMatches > 0) return 1;

    if (a.activeMatches !== b.activeMatches) {
      return b.activeMatches - a.activeMatches;
    }

    if (!a.hasValidDate && !b.hasValidDate) return a.index - b.index;
    if (!a.hasValidDate) return 1;
    if (!b.hasValidDate) return -1;

    if (a.nextEventTimestamp === null || b.nextEventTimestamp === null) return a.index - b.index;
    if (a.nextEventTimestamp === b.nextEventTimestamp) return a.index - b.index;
    return a.nextEventTimestamp - b.nextEventTimestamp;
  }).map(({ competition }) => competition);
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
