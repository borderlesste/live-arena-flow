import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

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

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
