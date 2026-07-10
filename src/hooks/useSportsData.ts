import { useQuery } from "@tanstack/react-query";
import { getEventById, getEventsByDate, getEventsByRange, getLiveEvents } from "@/services/sports.service";
import { dedupeSportsEvents, mapSportsEvents } from "@/services/sports-data.mapper";
import { listPublicVideoSources, type ManagedVideoSource } from "@/services/video-sources.service";
import { getMatchLocalDateKey, shiftDateKey } from "@/lib/format";
import { WORLD_CHAMPIONSHIP_END_DATE, WORLD_CHAMPIONSHIP_START_DATE } from "@/lib/world-championship";

export function usePublicVideoSources() {
  return useQuery({
    queryKey: ["sportsdb", "video-sources"],
    queryFn: listPublicVideoSources,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function sourcesOrEmpty(value: ManagedVideoSource[] | undefined): ManagedVideoSource[] {
  return value ?? [];
}

export function useSportsWindow() {
  const today = getMatchLocalDateKey(new Date().toISOString());
  const localDates = [shiftDateKey(today, -1), today, shiftDateKey(today, 1)];
  const localDateSet = new Set(localDates);
  const rangeStart = localDates[0];
  const rangeEnd = shiftDateKey(localDates[2], 1);
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "window", ...localDates],
    queryFn: async () => dedupeSportsEvents(await getEventsByRange(rangeStart, rangeEnd))
      .filter((event) => localDateSet.has(getMatchLocalDateKey(event.startsAt))),
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    bundle: mapSportsEvents(query.data ?? [], sourcesOrEmpty(sourcesQuery.data)),
  };
}

export const useMatches = useSportsWindow;
export const useCompetitions = useSportsWindow;

export function useLiveSportsWindow() {
  const sourcesQuery = usePublicVideoSources();
  const liveQuery = useQuery({
    queryKey: ["sportsdb", "live"],
    queryFn: getLiveEvents,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  const sourceMatchIds = [...new Set(sourcesOrEmpty(sourcesQuery.data)
    .filter((source) => source.isEnabled !== false && source.purpose !== "highlight" && (source.isPrimary || source.status === "live"))
    .map((source) => source.matchId)
    .filter(Boolean))]
    .sort();
  const sourceEventsQuery = useQuery({
    queryKey: ["sportsdb", "live-source-events", ...sourceMatchIds],
    queryFn: async () => {
      const settled = await Promise.allSettled(sourceMatchIds.map(getEventById));
      return settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    },
    enabled: sourceMatchIds.length > 0,
    staleTime: 30_000,
  });
  const events = dedupeSportsEvents([...(liveQuery.data ?? []), ...(sourceEventsQuery.data ?? [])]);
  const hasSourceFallback = sourceMatchIds.length > 0;

  return {
    ...liveQuery,
    isLoading: liveQuery.isLoading || (hasSourceFallback && sourceEventsQuery.isLoading && events.length === 0),
    isError: liveQuery.isError && (!hasSourceFallback || sourceEventsQuery.isError),
    refetch: async () => Promise.all([liveQuery.refetch(), sourceEventsQuery.refetch()]),
    bundle: mapSportsEvents(events, sourcesOrEmpty(sourcesQuery.data)),
  };
}

export const useLiveEvents = useLiveSportsWindow;

export function useMatchData(id: string | undefined) {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "event", id],
    queryFn: () => getEventById(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    bundle: mapSportsEvents(query.data ? [query.data] : [], sourcesOrEmpty(sourcesQuery.data)),
  };
}

export function useSportsDate(date: string | undefined) {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "date", date],
    queryFn: () => getEventsByDate(date!),
    enabled: Boolean(date),
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    bundle: mapSportsEvents(query.data ?? [], sourcesOrEmpty(sourcesQuery.data)),
  };
}

export const useCalendarEvents = useSportsDate;

export function useSportsRange(start: string | undefined, end: string | undefined) {
  const sourcesQuery = usePublicVideoSources();
  const query = useQuery({
    queryKey: ["sportsdb", "range", start, end],
    queryFn: () => getEventsByRange(start!, end!),
    enabled: Boolean(start && end),
    staleTime: 5 * 60_000,
  });
  return {
    ...query,
    bundle: mapSportsEvents(query.data ?? [], sourcesOrEmpty(sourcesQuery.data)),
  };
}

/** Covers the UTC days that can overlap one São Paulo calendar day. */
export function useSportsLocalDate(date: string | undefined) {
  return useSportsRange(date ? shiftDateKey(date, -1) : undefined, date ? shiftDateKey(date, 1) : undefined);
}

export function useWorldChampionshipData() {
  return useSportsRange(WORLD_CHAMPIONSHIP_START_DATE, WORLD_CHAMPIONSHIP_END_DATE);
}

export const useResults = useSportsWindow;
export const useWorldCupMatches = useWorldChampionshipData;
