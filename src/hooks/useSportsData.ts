import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { getEventById, getEventsByDate, getLiveEvents } from "@/services/sports.service";
import { mapSportsEvents } from "@/services/sports-data.mapper";
import { listPublicVideoSources } from "@/services/video-sources.service";

export function useSportsWindow() {
  const dates = [-1, 0, 1].map((offset) => format(addDays(new Date(), offset), "yyyy-MM-dd"));
  const query = useQuery({
    queryKey: ["sportsdb", "window", ...dates],
    queryFn: async () => {
      const [events, sources] = await Promise.all([
        Promise.all(dates.map(getEventsByDate)).then((values) => values.flat()),
        listPublicVideoSources(),
      ]);
      return { events, sources };
    },
    staleTime: 5 * 60_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], query.data?.sources ?? []) };
}

export function useLiveSportsWindow() {
  const query = useQuery({
    queryKey: ["sportsdb", "live"],
    queryFn: async () => {
      const [events, sources] = await Promise.all([getLiveEvents(), listPublicVideoSources()]);
      return { events, sources };
    },
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], query.data?.sources ?? []) };
}

export function useMatchData(id: string | undefined) {
  const query = useQuery({
    queryKey: ["sportsdb", "event", id],
    queryFn: async () => {
      const [event, sources] = await Promise.all([getEventById(id!), listPublicVideoSources()]);
      return { event, sources };
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
  const bundle = mapSportsEvents(query.data?.event ? [query.data.event] : [], query.data?.sources ?? []);
  return { ...query, bundle };
}

export function useSportsDate(date: string | undefined) {
  const query = useQuery({
    queryKey: ["sportsdb", "date", date],
    queryFn: async () => {
      const [events, sources] = await Promise.all([getEventsByDate(date!), listPublicVideoSources()]);
      return { events, sources };
    },
    enabled: Boolean(date),
    staleTime: 5 * 60_000,
  });
  return { ...query, bundle: mapSportsEvents(query.data?.events ?? [], query.data?.sources ?? []) };
}
