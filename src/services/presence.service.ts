import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type PresenceListener = (count: number) => void;
const listeners = new Set<PresenceListener>();
let channel: RealtimeChannel | undefined;
let heartbeatTimer: number | undefined;
let connecting: Promise<void> | undefined;
let currentCount = 0;

function stableId(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) { value = crypto.randomUUID(); storage.setItem(key, value); }
  return value;
}

function publish(count: number) {
  currentCount = count;
  listeners.forEach((listener) => listener(count));
}

async function heartbeat(deviceId: string, tabId: string) {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  if (!data.session) return;
  await client.rpc("heartbeat_presence", { p_device_id: deviceId, p_tab_id: tabId, p_state: "chatting", p_stream_id: null });
}

async function connect() {
  if (!isSupabaseConfigured || channel) return;
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  if (!data.session) return;
  const deviceId = stableId(localStorage, "arena-live:device-id");
  const tabId = stableId(sessionStorage, "arena-live:tab-id");
  channel = client.channel("presence:global", { config: { presence: { key: deviceId } } });
  channel.on("presence", { event: "sync" }, () => publish(Object.keys(channel?.presenceState() ?? {}).length));
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel?.track({ user_id: data.session.user.id, device_id: deviceId, state: "chatting", online_at: new Date().toISOString() });
      await heartbeat(deviceId, tabId);
    }
  });
  heartbeatTimer = window.setInterval(() => { void heartbeat(deviceId, tabId); }, 30_000);
}

export function subscribePresence(listener: PresenceListener): () => void {
  listener(currentCount);
  if (!isSupabaseConfigured) return () => undefined;
  listeners.add(listener);
  connecting ??= connect().finally(() => { connecting = undefined; });
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
    const active = channel;
    channel = undefined;
    if (active) void getSupabaseClient().then(async (client) => { await active.untrack(); await client.removeChannel(active); });
    publish(0);
  };
}

