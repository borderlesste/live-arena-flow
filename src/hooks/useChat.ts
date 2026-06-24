import { useEffect, useRef, useState, useCallback } from "react";
import { listChatMessages, postChatMessage, subscribeChatMessages } from "@/services/chat.service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { chatMessageInputSchema } from "@/schemas/chat.schema";
import type { ChatMessage } from "@/types";

const SLOW_MODE_MS = 4000;

export interface UseChatResult {
  messages: ChatMessage[];
  send: (text: string, channel: "community" | "official") => Promise<{ ok: boolean; error?: string }>;
  slowModeRemaining: number;
  pinned: ChatMessage | null;
}

export function useChat(roomKey = "global"): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [slowModeRemaining, setSlow] = useState(0);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const next = await listChatMessages(roomKey);
        if (active) setMessages(next);
      } catch { /* network state is surfaced by the panel */ }
    }
    void refresh();
    const unsubscribe = subscribeChatMessages(roomKey, (message) => {
      if (active) setMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-200));
    });
    const interval = isSupabaseConfigured ? undefined : window.setInterval(refresh, 3000);
    return () => { active = false; unsubscribe(); if (interval) window.clearInterval(interval); };
  }, [roomKey]);

  useEffect(() => {
    if (slowModeRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setSlow(Math.max(0, Math.ceil((lastSentRef.current + SLOW_MODE_MS - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [slowModeRemaining]);

  const send = useCallback(async (text: string, channel: "community" | "official") => {
    const parsed = chatMessageInputSchema.safeParse({ text, channel });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensaje inválido" };
    const now = Date.now();
    if (now - lastSentRef.current < SLOW_MODE_MS) return { ok: false, error: "Modo lento activo, espera un momento" };
    try {
      const message = await postChatMessage(parsed.data.text, parsed.data.channel, roomKey);
      lastSentRef.current = now;
      setSlow(Math.ceil(SLOW_MODE_MS / 1000));
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message].slice(-200));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "No se pudo enviar el mensaje" };
    }
  }, [roomKey]);

  return { messages, send, slowModeRemaining, pinned: messages.find((message) => message.pinned) ?? null };
}
