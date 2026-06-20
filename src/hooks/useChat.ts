import { useEffect, useRef, useState, useCallback } from "react";
import { getSeedChat, subscribeChat } from "@/services/chat.service";
import { chatMessageInputSchema } from "@/schemas/chat.schema";
import type { ChatMessage } from "@/types";

const MAX_MESSAGES = 200;
const SLOW_MODE_MS = 4000;

export interface UseChatResult {
  messages: ChatMessage[];
  send: (text: string, channel: "community" | "official") => { ok: boolean; error?: string };
  slowModeRemaining: number;
  pinned: ChatMessage | null;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getSeedChat());
  const [slowModeRemaining, setSlow] = useState(0);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    const unsub = subscribeChat((m) => {
      setMessages((prev) => {
        const next = [...prev, m];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    });
    return unsub;
  }, []);

  // Slow-mode countdown
  useEffect(() => {
    if (slowModeRemaining <= 0) return;
    const t = setInterval(() => {
      setSlow((v) => {
        const diff = lastSentRef.current + SLOW_MODE_MS - Date.now();
        return Math.max(0, Math.ceil(diff / 1000));
      });
    }, 250);
    return () => clearInterval(t);
  }, [slowModeRemaining]);

  const send = useCallback((text: string, channel: "community" | "official") => {
    const parsed = chatMessageInputSchema.safeParse({ text, channel });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensaje inválido" };

    const now = Date.now();
    if (now - lastSentRef.current < SLOW_MODE_MS) {
      return { ok: false, error: "Modo lento activo, espera un momento" };
    }
    lastSentRef.current = now;
    setSlow(Math.ceil(SLOW_MODE_MS / 1000));

    const message: ChatMessage = {
      id: `me-${now}`,
      user: { id: "me", name: "Tú", avatarColor: "142 90% 55%" },
      text: parsed.data.text,
      channel: parsed.data.channel,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    return { ok: true };
  }, []);

  const pinned = messages.find((m) => m.pinned) ?? null;
  return { messages, send, slowModeRemaining, pinned };
}
