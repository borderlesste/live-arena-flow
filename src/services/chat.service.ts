// Chat service — local mock. Real chat needs a backend (WebSocket / Realtime),
// authentication, moderation, rate limiting and persistence.

import { seedChat, botUsers } from "@/data/chatSeed";
import type { ChatMessage } from "@/types";

type Listener = (msg: ChatMessage) => void;

const listeners = new Set<Listener>();
let interval: ReturnType<typeof setInterval> | null = null;

const sampleLines = [
  "¡Qué jugada!",
  "Vamos equipo",
  "El árbitro... 😅",
  "Esto está increíble",
  "Saludos desde casa",
  "Mejor partido del mes",
  "Atajada brutal",
  "Gol cantado",
];

function startBot() {
  if (interval) return;
  interval = setInterval(() => {
    if (listeners.size === 0) return;
    const user = botUsers[Math.floor(Math.random() * botUsers.length)];
    const msg: ChatMessage = {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user,
      text: sampleLines[Math.floor(Math.random() * sampleLines.length)],
      channel: Math.random() > 0.15 ? "community" : "official",
      createdAt: new Date().toISOString(),
    };
    listeners.forEach((l) => l(msg));
  }, 5500);
}

export function subscribeChat(listener: Listener): () => void {
  listeners.add(listener);
  startBot();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

export function getSeedChat(): ChatMessage[] {
  return [...seedChat];
}
