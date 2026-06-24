import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Flag, Users, Pin, ShieldAlert, ArrowDown, WifiOff } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { reportChatMessage } from "@/services/chat.service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { usePresence } from "@/hooks/usePresence";

const EMOJIS = ["⚽", "🏀", "🔥", "👏", "🎉", "💪", "😂", "😮", "🤩", "❤️"];

interface ChatPanelProps {
  className?: string;
  matchTitle?: string;
  roomKey?: string;
}

export function ChatPanel({ className, matchTitle, roomKey = "global" }: ChatPanelProps) {
  const { messages, send, slowModeRemaining, pinned } = useChat(roomKey);
  const onlineCount = usePresence();
  const [channel, setChannel] = useState<"community" | "official">("community");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastLengthRef = useRef(messages.length);
  const online = useNetworkStatus();

  const filtered = messages.filter((m) => m.channel === channel);

  function isNearBottom(): boolean {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const grew = messages.length > lastLengthRef.current;
    lastLengthRef.current = messages.length;
    if (grew) {
      if (isNearBottom()) {
        el.scrollTop = el.scrollHeight;
      } else {
        setShowJump(true);
      }
    }
  }, [messages]);

  function onScroll() {
    if (isNearBottom()) setShowJump(false);
  }

  function jumpToBottom() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }

  async function submit() {
    const res = await send(text, channel);
    if (!res.ok) { setError(res.error ?? "Error"); return; }
    setError(null);
    setText("");
    setTimeout(jumpToBottom, 30);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function insertEmoji(em: string) {
    setText((t) => (t + em).slice(0, 280));
  }

  const usersCount = isSupabaseConfigured ? onlineCount : new Set(messages.map((m) => m.user.id)).size;

  return (
    <aside className={cn("surface-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl", className)} aria-label="Chat en vivo">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">Chat en vivo</p>
          {matchTitle ? <p className="truncate text-xs text-muted-foreground">{matchTitle}</p> : null}
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {usersCount.toLocaleString("es")}
        </span>
      </header>

      <Tabs value={channel} onValueChange={(v) => setChannel(v as "community" | "official")} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-2 bg-surface-2">
          <TabsTrigger value="community">Comunidad</TabsTrigger>
          <TabsTrigger value="official">Oficial</TabsTrigger>
        </TabsList>

        {pinned && channel === pinned.channel ? (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
            <Pin className="mt-0.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <p><span className="font-semibold">{pinned.user.name}:</span> {pinned.text}</p>
          </div>
        ) : null}

        <TabsContent value={channel} className="relative mt-0 flex min-h-0 flex-1 flex-col">
          {!online ? (
            <div className="m-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-warning">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Sin conexión. Reconectando…
            </div>
          ) : null}

          <div
            ref={listRef}
            onScroll={onScroll}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
            tabIndex={0}
            aria-label="Mensajes del chat"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Aún no hay mensajes en este canal.</p>
            ) : filtered.map((m) => <ChatMessageItem key={m.id} message={m} />)}
          </div>

          {showJump ? (
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 shadow-elegant"
              onClick={jumpToBottom}
            >
              <ArrowDown className="mr-1 h-4 w-4" /> Nuevos mensajes
            </Button>
          ) : null}

          <div className="border-t border-border bg-surface/40 p-2.5">
            <div className="flex items-end gap-2">
              <Textarea
                value={text}
                onChange={(e) => { setText(e.target.value.slice(0, 280)); setError(null); }}
                onKeyDown={onKey}
                placeholder={slowModeRemaining > 0 ? `Modo lento: espera ${slowModeRemaining}s` : "Escribe un mensaje…"}
                rows={1}
                aria-label="Mensaje del chat"
                aria-invalid={error ? true : undefined}
                disabled={slowModeRemaining > 0 || !online}
                className="min-h-[40px] resize-none bg-surface-2"
                maxLength={280}
              />
              <div className="flex flex-col items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => void submit()}
                  disabled={slowModeRemaining > 0 || !online || text.trim().length === 0}
                  aria-label="Enviar mensaje"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="rounded px-1.5 py-0.5 text-base hover:bg-surface-2"
                  aria-label={`Insertar ${e}`}
                >
                  {e}
                </button>
              ))}
              <span className="ml-auto tabular-nums">{text.length}/280</span>
            </div>
            {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
          </div>
        </TabsContent>
      </Tabs>

      <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" aria-hidden="true" /> Respeta las normas de la comunidad.</span>
        <a href="/community-rules" className="underline-offset-2 hover:underline">Normas</a>
      </footer>
    </aside>
  );
}

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const hour = format(new Date(message.createdAt), "HH:mm");
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-primary-foreground"
        style={{ background: `hsl(${message.user.avatarColor})` }}
      >
        {message.user.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-1.5 text-xs">
          <span className="font-semibold text-foreground">{message.user.name}</span>
          {message.user.badges?.includes("official") ? <span className="rounded bg-primary/20 px-1 text-[10px] font-bold uppercase text-primary">Oficial</span> : null}
          {message.user.badges?.includes("mod") ? <span className="rounded bg-accent/20 px-1 text-[10px] font-bold uppercase text-accent">Mod</span> : null}
          {message.user.badges?.includes("vip") ? <span className="rounded bg-warning/20 px-1 text-[10px] font-bold uppercase text-warning">VIP</span> : null}
          <span className="text-muted-foreground">{hour}</span>
        </p>
        <p className="break-words text-sm text-foreground/95">{message.text}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {isSupabaseConfigured ? <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => void reportChatMessage(message.id).then(() => toast.success("Mensaje reportado")).catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo reportar"))} className="rounded p-0.5 hover:bg-surface-2" aria-label="Reportar">
                <Flag className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reportar</TooltipContent>
          </Tooltip> : null}
        </div>
      </div>
    </div>
  );
}
