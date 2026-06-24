import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessionToken } from "@/services/auth.service";
import { listFavoriteMatches, setFavoriteMatch, type FavoriteMatchRecord } from "@/services/favorites.service";
import { getEventById } from "@/services/sports.service";

export function useFavoriteMatches() {
  const queryClient = useQueryClient();
  const token = getSessionToken();
  const queryKey = useMemo(() => ["favorite-matches", token] as const, [token]);
  const query = useQuery({
    queryKey,
    queryFn: () => listFavoriteMatches(token!),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const setFavorite = useCallback(async (matchId: string, favorite: boolean) => {
    if (!token) throw new Error("Inicia sesión para seguir partidos");
    await setFavoriteMatch(token, matchId, favorite);
    queryClient.setQueryData<FavoriteMatchRecord[]>(queryKey, (current = []) => favorite
      ? [{ externalMatchId: matchId, createdAt: new Date().toISOString() }, ...current.filter((item) => item.externalMatchId !== matchId)]
      : current.filter((item) => item.externalMatchId !== matchId));
  }, [queryClient, queryKey, token]);

  return { ...query, favorites: query.data ?? [], available: Boolean(token), setFavorite };
}

export function useFavoriteMatch(matchId: string | undefined) {
  const favorites = useFavoriteMatches();
  const favorite = Boolean(matchId && favorites.favorites.some((item) => item.externalMatchId === matchId));
  const toggle = useCallback(async () => {
    if (!matchId) throw new Error("No se pudo identificar el partido");
    const next = !favorite;
    await favorites.setFavorite(matchId, next);
    return next;
  }, [favorite, favorites, matchId]);
  return { favorite, available: favorites.available, isLoading: favorites.isLoading, toggle };
}

export function useFavoriteMatchEvents() {
  const favorites = useFavoriteMatches();
  const ids = favorites.favorites.map((item) => item.externalMatchId);
  const events = useQuery({
    queryKey: ["favorite-match-events", ids],
    queryFn: async () => Promise.all(ids.map(async (id) => ({ id, event: await getEventById(id).catch(() => undefined) }))),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
  return { ...events, favorites: favorites.favorites, setFavorite: favorites.setFavorite, available: favorites.available };
}
