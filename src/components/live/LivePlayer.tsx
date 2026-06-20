import { useMemo, useRef, useState } from "react";
import { HlsPlayer } from "./HlsPlayer";
import { EmbedPlayer } from "./EmbedPlayer";
import { Html5Player } from "./Html5Player";
import { Scoreboard } from "./Scoreboard";
import { PlayerControls } from "./PlayerControls";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveStream, type DemoState } from "@/hooks/useLiveStream";
import { pickAdapter } from "@/services/streaming.service";
import { AlertTriangle, WifiOff, RefreshCw, Tv, Ban, Bug } from "lucide-react";
import type { Match, StreamSource, Team } from "@/types";

interface LivePlayerProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competitionName: string;
  onChangeStream?: (streamId: string) => void;
}

const DEMO_LABEL: Record<DemoState, string> = {
  auto: "Auto",
  active: "Activo",
  offline: "Sin transmisión",
  error: "Error",
  reconnecting: "Reconectando",
  blocked: "Embed bloqueado",
  skeleton: "Skeleton",
};

export function LivePlayer({ match, homeTeam, awayTeam, competitionName, onChangeStream }: LivePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [demo, setDemo] = useState<DemoState>("auto");
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(match.streams[0]?.id);

  const source: StreamSource | undefined = useMemo(
    () => match.streams.find((s) => s.id === selectedStreamId) ?? match.streams[0],
    [match.streams, selectedStreamId],
  );

  const { status, retry } = useLiveStream(source, demo);
  const adapter = source ? pickAdapter(source) : "unsupported";

  function handleSelect(v: string) {
    setSelectedStreamId(v);
    onChangeStream?.(v);
  }

  return (
    <div ref={containerRef} className="surface-card relative overflow-hidden rounded-xl shadow-glow">
      <div className="relative aspect-video w-full bg-black">
        {renderPlayerBody({ status, adapter, source, retry })}

        {/* Overlay (top) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent">
          <Scoreboard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competitionName={competitionName} />
        </div>

        {/* Overlay (bottom) */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-3 md:p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            {match.streams.length > 1 ? (
              <Select value={source?.id} onValueChange={handleSelect}>
                <SelectTrigger className="h-9 w-[180px] bg-black/55 ring-1 ring-white/10" aria-label="Cambiar transmisión">
                  <SelectValue placeholder="Transmisión" />
                </SelectTrigger>
                <SelectContent>
                  {match.streams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={demo} onValueChange={(v) => setDemo(v as DemoState)}>
              <SelectTrigger className="h-9 w-[150px] bg-black/55 ring-1 ring-white/10" aria-label="Estado de demostración">
                <Bug className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DEMO_LABEL) as DemoState[]).map((d) => (
                  <SelectItem key={d} value={d}>{DEMO_LABEL[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PlayerControls containerRef={containerRef} />
        </div>
      </div>
    </div>
  );
}

function renderPlayerBody({
  status, adapter, source, retry,
}: { status: string; adapter: ReturnType<typeof pickAdapter>; source: StreamSource | undefined; retry: () => void; }) {
  if (status === "loading") {
    return <SkeletonLoader className="absolute inset-0 h-full w-full rounded-none" />;
  }
  if (status === "offline" || !source) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
        <EmptyState
          icon={<Tv className="h-8 w-8" />}
          title="No hay transmisión disponible"
          description="Este partido aún no está en directo. Vuelve más tarde o elige otro evento."
        />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
        <ErrorState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Se interrumpió la transmisión"
          description="Error ARN-STR-4012. Intenta reanudar o elige otra fuente."
          action={<Button onClick={retry}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>}
        />
      </div>
    );
  }
  if (status === "buffering") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
        <ErrorState
          tone="warning"
          icon={<WifiOff className="h-8 w-8" />}
          title="Reconectando…"
          description="Se perdió la conexión brevemente. Intentamos retomar la señal."
          action={<Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>}
        />
      </div>
    );
  }
  if (status === "blocked") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
        <ErrorState
          tone="warning"
          icon={<Ban className="h-8 w-8" />}
          title="Embed bloqueado"
          description="El navegador o una extensión está bloqueando esta fuente. Prueba otra transmisión."
          action={<Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>}
        />
      </div>
    );
  }

  // Active
  if (adapter === "hls" && source.url) {
    return <HlsPlayer src={source.url} className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (adapter === "html5" && source.url) {
    return <Html5Player src={source.url} className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (adapter === "embed" && source.embedUrl) {
    return (
      <EmbedPlayer
        embedUrl={source.embedUrl}
        title={source.title}
        requiresConsent={source.requiresConsent}
        className="absolute inset-0 h-full w-full"
      />
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
      <ErrorState tone="warning" icon={<Ban className="h-8 w-8" />} title="Origen no soportado" description="Esta fuente no puede reproducirse directamente." />
    </div>
  );
}
