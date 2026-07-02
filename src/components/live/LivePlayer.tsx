import { useMemo, useRef, useState } from "react";
import { HlsPlayer } from "./HlsPlayer";
import { EmbedPlayer } from "./EmbedPlayer";
import { Html5Player } from "./Html5Player";
import { Scoreboard } from "./Scoreboard";
import { PlayerControls } from "./PlayerControls";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveStream } from "@/hooks/useLiveStream";
import { pickAdapter } from "@/services/streaming.service";
import { AlertTriangle, WifiOff, RefreshCw, Ban } from "lucide-react";
import type { Match, StreamSource, Team } from "@/types";

interface LivePlayerProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competitionName: string;
  onChangeStream?: (streamId: string) => void;
}

export function LivePlayer({ match, homeTeam, awayTeam, competitionName, onChangeStream }: LivePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(match.streams[0]?.id);

  const source: StreamSource | undefined = useMemo(
    () => match.streams.find((s) => s.id === selectedStreamId) ?? match.streams[0],
    [match.streams, selectedStreamId],
  );

  const { status, retry } = useLiveStream(source);
  const adapter = source ? pickAdapter(source) : "unsupported";
  const mediaControlsEnabled = status === "live" && (adapter === "hls" || adapter === "html5");
  const isLive = match.status === "live" || match.status === "halftime";

  function handleSelect(v: string) {
    setSelectedStreamId(v);
    onChangeStream?.(v);
  }

  function handleSourceError() {
    const currentIndex = match.streams.findIndex((item) => item.id === source?.id);
    const fallback = match.streams[currentIndex + 1];
    if (fallback) handleSelect(fallback.id);
  }

  return (
    <div ref={containerRef} className="surface-card relative min-w-0 overflow-hidden rounded-xl shadow-glow">
      <div className="relative aspect-[4/3] w-full bg-black sm:aspect-video">
        {renderPlayerBody({ status, adapter, source, retry, onSourceError: handleSourceError })}

        {/* Overlay (top) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent">
          <Scoreboard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competitionName={competitionName} />
        </div>

        {/* Standard full-width media controls */}
        <div className="absolute inset-x-0 bottom-0 z-20">
          <PlayerControls
            containerRef={containerRef}
            mediaControlsEnabled={mediaControlsEnabled}
            mediaKey={source?.id}
            isLive={isLive}
            streamSwitcher={match.streams.length > 1 ? (
              <Select value={source?.id} onValueChange={handleSelect}>
                <SelectTrigger className="h-8 w-[170px] border-white/10 bg-white/10 text-xs text-white hover:bg-white/15" aria-label="Cambiar transmisión">
                  <SelectValue placeholder="Transmisión" />
                </SelectTrigger>
                <SelectContent>
                  {match.streams.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>{stream.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          />
        </div>
      </div>
    </div>
  );
}

function renderPlayerBody({
  status, adapter, source, retry, onSourceError,
}: { status: string; adapter: ReturnType<typeof pickAdapter>; source: StreamSource | undefined; retry: () => void; onSourceError: () => void; }) {
  if (status === "loading") {
    return <div className="absolute inset-0 grid place-items-center"><SkeletonLoader className="absolute inset-0 h-full w-full rounded-none" /><BrandLogo variant="white" size="lg" withWordmark={false} decorative className="relative z-10 animate-pulse opacity-80" /></div>;
  }
  if (status === "offline" || !source) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6">
        <EmptyState
          icon={<BrandLogo variant="white" size="lg" withWordmark={false} decorative className="opacity-80" />}
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
    return <HlsPlayer src={source.url} onStatusChange={(next) => { if (next === "error") onSourceError(); }} className="absolute inset-0 h-full w-full object-cover" />;
  }
  if (adapter === "html5" && source.url) {
    return <Html5Player src={source.url} audioOnly={source.type === "mp3"} onError={onSourceError} className={source.type === "mp3" ? "absolute inset-x-6 bottom-1/2 w-[calc(100%-3rem)] translate-y-1/2" : "absolute inset-0 h-full w-full object-cover"} />;
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
