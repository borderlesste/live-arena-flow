import { useState } from "react";
import { Maximize2, Pause, PictureInPicture2, Play, Share2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface PlayerControlsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  shareUrl?: string;
  mediaControlsEnabled: boolean;
}

export function PlayerControls({ containerRef, shareUrl, mediaControlsEnabled }: PlayerControlsProps) {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(70);
  const [playing, setPlaying] = useState(false);

  function mediaElement() {
    return containerRef.current?.querySelector("video, audio") as HTMLMediaElement | null;
  }

  async function togglePlayback() {
    const media = mediaElement();
    if (!media) { toast.info("La transmisión todavía no está disponible"); return; }
    try {
      if (media.paused) { await media.play(); setPlaying(true); }
      else { media.pause(); setPlaying(false); }
    } catch (error) {
      const errorName = error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
      if (errorName === "NotAllowedError") {
        toast.error("El navegador bloqueó la reproducción");
      } else if (errorName === "NotSupportedError") {
        toast.warning("La transmisión todavía no está disponible");
      } else {
        toast.error("No se pudo iniciar la reproducción");
      }
    }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => toast.error("Fullscreen no disponible"));
    } else {
      document.exitFullscreen?.().catch(() => {/* noop */});
    }
  }

  function togglePip() {
    const video = containerRef.current?.querySelector("video");
    if (!video) { toast.info("PiP no disponible para este origen"); return; }
    const v = video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> };
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture?.().catch(() => {});
    } else {
      v.requestPictureInPicture?.().catch(() => toast.error("PiP rechazado por el navegador"));
    }
  }

  async function share() {
    const url = shareUrl ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ url, title: "Luis Romero Fútbol" });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado al portapapeles"); }
    } catch {
      toast.error("No se pudo compartir");
    }
  }

  function applyVolume(v: number) {
    setVolume(v);
    const media = mediaElement();
    if (media) { media.volume = v / 100; media.muted = v === 0; }
    setMuted(v === 0);
  }

  return (
    <div data-testid="player-controls" className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/55 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={() => void togglePlayback()} disabled={!mediaControlsEnabled} aria-label={playing ? "Pausar" : "Reproducir"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{playing ? "Pausar" : "Reproducir"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={() => applyVolume(muted ? volume || 70 : 0)} disabled={!mediaControlsEnabled} aria-label={muted ? "Activar sonido" : "Silenciar"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Volumen</TooltipContent>
      </Tooltip>
      <div className="hidden w-24 md:block">
        <Slider value={[muted ? 0 : volume]} onValueChange={(v) => applyVolume(v[0] ?? 0)} disabled={!mediaControlsEnabled} max={100} step={1} aria-label="Nivel de volumen" />
      </div>
      <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="hidden h-9 w-9 text-foreground hover:bg-white/10 sm:inline-flex" onClick={togglePip} disabled={!mediaControlsEnabled} aria-label="Picture in picture">
            <PictureInPicture2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Picture in picture</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={share} aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compartir</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={toggleFullscreen} aria-label="Pantalla completa">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Pantalla completa</TooltipContent>
      </Tooltip>
    </div>
  );
}
