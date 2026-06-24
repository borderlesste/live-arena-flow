import { sportsEventsResponseSchema, type NormalizedSportsEvent } from "@/schemas/sports-event.schema";
import { publicEnv } from "@/config/env";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

async function requestEvents(endpoint: string, params: Record<string, string> = {}): Promise<NormalizedSportsEvent[]> {
  const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`El proveedor deportivo respondió ${response.status}`);
  const parsed = sportsEventsResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("El backend devolvió datos deportivos inválidos");
  return parsed.data.events;
}

export function getEventsByDate(date: string) { return requestEvents("sports/events", { date }); }
export function getLiveEvents() { return requestEvents("sports/live"); }
export function getEventById(id: string) { return requestEvents(`sports/events/${encodeURIComponent(id)}`, {}).then((events) => events[0]); }
