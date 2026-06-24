import { publicEnv } from "@/config/env";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface FavoriteMatchRecord {
  externalMatchId: string;
  createdAt: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return response.json();
}

export async function listFavoriteMatches(token: string): Promise<FavoriteMatchRecord[]> {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data: session } = await client.auth.getSession();
    if (!session.session) throw new Error("Inicia sesión para consultar tus partidos");
    const { data, error } = await client
      .from("user_favorite_matches")
      .select("external_match_id, created_at")
      .eq("user_id", session.session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((item) => ({ externalMatchId: item.external_match_id, createdAt: item.created_at }));
  }

  return fetch(`${API_BASE}/favorites/matches`, { headers: { Authorization: `Bearer ${token}` } })
    .then(responseJson<FavoriteMatchRecord[]>);
}

export async function setFavoriteMatch(token: string, externalMatchId: string, favorite: boolean): Promise<void> {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data: session } = await client.auth.getSession();
    if (!session.session) throw new Error("Inicia sesión para seguir partidos");
    const result = favorite
      ? await client.from("user_favorite_matches").upsert(
        { user_id: session.session.user.id, external_match_id: externalMatchId },
        { onConflict: "user_id,external_match_id" },
      )
      : await client.from("user_favorite_matches").delete().eq("user_id", session.session.user.id).eq("external_match_id", externalMatchId);
    if (result.error) throw new Error(result.error.message);
    return;
  }

  await fetch(`${API_BASE}/favorites/matches/${encodeURIComponent(externalMatchId)}`, {
    method: favorite ? "PUT" : "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(responseJson);
}
