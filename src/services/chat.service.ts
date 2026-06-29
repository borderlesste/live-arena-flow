import type { RealtimeChannel } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";
import type { ChatMessage } from "@/types";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

interface ChatRow {
  id: string;
  user_id: string;
  body: string;
  channel: "community" | "official";
  display_name_snapshot: string;
  avatar_color_snapshot: string;
  pinned: boolean;
  created_at: string;
}

interface SharedRoomSubscription {
  listeners: Set<(message: ChatMessage) => void>;
  channel?: RealtimeChannel;
  connecting?: Promise<void>;
}

const sharedRooms = new Map<string, SharedRoomSubscription>();

function mapChatRow(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    user: { id: row.user_id, name: row.display_name_snapshot, avatarColor: row.avatar_color_snapshot },
    text: row.body,
    createdAt: row.created_at,
    channel: row.channel,
    pinned: row.pinned,
  };
}

function clientIdentity() {
  let id = localStorage.getItem("arena-live:chat-client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("arena-live:chat-client-id", id);
  }
  return { clientId: id, displayName: localStorage.getItem("arena-live:chat-display-name") || `Invitado ${id.slice(0, 4)}` };
}

async function realtimeRoomId(roomKey: string): Promise<string | undefined> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from("chat_rooms").select("id").eq("room_key", roomKey).eq("enabled", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id) return data.id;
  const { data: session } = await client.auth.getSession();
  if (!session.session) return undefined;
  const { data: roomId, error: ensureError } = await client.rpc("ensure_chat_room", { p_room_key: roomKey });
  if (ensureError) throw new Error(ensureError.message);
  return roomId as string;
}

export async function listChatMessages(roomKey = "global"): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) {
    const response = await fetch(`${API_BASE}/chat/messages`);
    if (!response.ok) throw new Error("No se pudo cargar el chat");
    return response.json();
  }
  const roomId = await realtimeRoomId(roomKey);
  if (!roomId) return [];
  const client = await getSupabaseClient();
  const { data, error } = await client.from("chat_messages")
    .select("id,user_id,body,channel,display_name_snapshot,avatar_color_snapshot,pinned,created_at")
    .eq("room_id", roomId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data as ChatRow[]).reverse().map(mapChatRow);
}

export async function postChatMessage(text: string, channel: "community" | "official", roomKey = "global"): Promise<ChatMessage> {
  if (!isSupabaseConfigured) {
    const response = await fetch(`${API_BASE}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, channel, ...clientIdentity() }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "No se pudo enviar el mensaje");
    }
    return response.json();
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("send_chat_message", { p_room_key: roomKey, p_body: text, p_channel: channel });
  if (error) {
    if (error.message === "ACCOUNT_NOT_ACTIVE") throw new Error("Tu perfil no está activo para participar en el chat. Cierra sesión e inicia nuevamente si acabas de crear la cuenta.");
    const labels: Record<string, string> = {
      AUTHENTICATION_REQUIRED: "Inicia sesión para participar en el chat",
      SLOW_MODE: "Modo lento activo, espera un momento",
      CHAT_RESTRICTED: "Tu cuenta tiene restringido el chat",
      OFFICIAL_CHANNEL_FORBIDDEN: "Solo el equipo de moderación puede publicar en el canal oficial",
    };
    throw new Error(labels[error.message] ?? error.message);
  }
  return mapChatRow(data as ChatRow);
}

export function subscribeChatMessages(roomKey: string, listener: (message: ChatMessage) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const shared = sharedRooms.get(roomKey) ?? { listeners: new Set() };
  shared.listeners.add(listener);
  sharedRooms.set(roomKey, shared);

  shared.connecting ??= (async () => {
    const roomId = await realtimeRoomId(roomKey);
    if (!roomId || shared.channel) return;
    const client = await getSupabaseClient();
    shared.channel = client.channel(`chat:${roomKey}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        const message = mapChatRow(payload.new as ChatRow);
        shared.listeners.forEach((current) => current(message));
      })
      .subscribe();
  })()
    .catch(() => undefined)
    .finally(() => { shared.connecting = undefined; });

  return () => {
    shared.listeners.delete(listener);
    if (shared.listeners.size > 0) return;
    sharedRooms.delete(roomKey);
    if (shared.channel) void getSupabaseClient().then((client) => client.removeChannel(shared.channel!));
  };
}

export async function reportChatMessage(messageId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Los reportes requieren configurar Supabase");
  const client = await getSupabaseClient();
  const { data: session } = await client.auth.getSession();
  if (!session.session) throw new Error("Inicia sesión para reportar un mensaje");
  const { error } = await client.from("chat_message_reports").insert({ message_id: messageId, reporter_id: session.session.user.id, reason: "user_report" });
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);
}

export async function deleteOwnChatMessage(messageId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("El borrado seguro requiere configurar Supabase");
  const client = await getSupabaseClient();
  const { error } = await client.rpc("delete_own_chat_message", { p_message_id: messageId });
  if (error) throw new Error(error.message);
}

export async function moderateChatMessage(
  messageId: string,
  action: "delete" | "pin" | "unpin",
  reason?: string,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("La moderación segura requiere configurar Supabase");
  const client = await getSupabaseClient();
  const { error } = await client.rpc("moderate_chat_message", {
    p_message_id: messageId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
