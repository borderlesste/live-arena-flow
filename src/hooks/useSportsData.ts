import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { getEventById, getEventsByDate, getLiveEvents } from "@/services/sports.service";
import { mapSportsEvents } from "@/services/sports-data.mapper";
import { listPublicVideoSources, type ManagedVideoSource } from "@/services/video-sources.service";

export function usePublicVideoSources() {
  return useQuery({
    queryKey: ["sportsdb", "video-sources"],
    queryFn: () => listPublicVideoSources(),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function coerceSources(value: unknown): ManagedVideoSource[] {
  return Array.isArray(value) ? value as ManagedVideoSource[] : [];
}

export function useSportsWindow() {
  const dates = [-1, 0, 1].map((offset) => format(addDays(new Date(), offset), "yyyy-MM-dd"));
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "window", ...dates],
    queryFn: async () => {
      const [rawEvents, sources] = await Promise.all([
        Promise.all(dates.map(getEventsByDate)).then((values) => values.flat()),
        sourcesQuery.data ?? [],
      ]);
      const events = [...new Map(rawEvents.map((event) => [event.id, event])).values()];
      return { events, sources };
    },
    staleTime: 5 * 60_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], sourcesQuery.data ?? coerceSources(query.data?.sources)) };
}

export const useMatches = useSportsWindow;
export const useCompetitions = useSportsWindow;

export function useLiveSportsWindow() {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "live"],
    queryFn: async () => {
      const events = await getLiveEvents();
      const sources = sourcesQuery.data ?? [];
      return { events, sources };
    },
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], sourcesQuery.data ?? coerceSources(query.data?.sources)) };
}

export const useLiveEvents = useLiveSportsWindow;

export function useMatchData(id: string | undefined) {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "event", id],
    queryFn: async () => {
      const event = await getEventById(id!);
      const sources = sourcesQuery.data ?? [];
      return { event, sources };
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
  const bundle = mapSportsEvents(query.data?.event ? [query.data.event] : [], coerceSources(query.data?.sources));
  return { ...query, bundle };
}

export function useSportsDate(date: string | undefined) {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "date", date],
    queryFn: async () => {
      const events = await getEventsByDate(date!);
      const sources = sourcesQuery.data ?? [];
      return { events, sources };
    },
    enabled: Boolean(date),
    staleTime: 5 * 60_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], coerceSources(query.data?.sources)) };
}

export const useCalendarEvents = useSportsDate;

/** Fetches events for a set of day offsets relative to today (local calendar). */
export function useSportsDateOffsets(offsets: number[]) {
  const dates = offsets.map((offset) => format(addDays(new Date(), offset), "yyyy-MM-dd"));
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "offsets", ...dates],
    queryFn: async () => {
      const [rawEvents, liveEvents, sources] = await Promise.all([
        Promise.all(dates.map(getEventsByDate)).then((values) => values.flat()),
        getLiveEvents(),
        sourcesQuery.data ?? [],
      ]);
      const events = [...new Map([...rawEvents, ...liveEvents].map((event) => [event.id, event])).values()];
      return { events, sources };
    },
    staleTime: 5 * 60_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], sourcesQuery.data ?? coerceSources(query.data?.sources)) };
}

const WORLD_CHAMPIONSHIP_DAY_OFFSETS = Array.from({ length: 29 }, (_, index) => index - 14);

export function useWorldChampionshipData() {
  return useSportsDateOffsets(WORLD_CHAMPIONSHIP_DAY_OFFSETS);
}

export const useResults = useSportsWindow;
export const useWorldCupMatches = useWorldChampionshipData;
