import { useRef, useState } from "react";
import { Maximize2, PictureInPicture2, Share2, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface PlayerControlsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  shareUrl?: string;
}

export function PlayerControls({ containerRef, shareUrl }: PlayerControlsProps) {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(70);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      if (navigator.share) await navigator.share({ url, title: "Arena Live Sports" });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado al portapapeles"); }
    } catch {
      toast.error("No se pudo compartir");
    }
  }

  function applyVolume(v: number) {
    setVolume(v);
    const video = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (video) { video.volume = v / 100; video.muted = v === 0; }
    setMuted(v === 0);
  }

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/55 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur">
      <audio ref={audioRef} hidden />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={() => applyVolume(muted ? volume || 70 : 0)} aria-label={muted ? "Activar sonido" : "Silenciar"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Volumen</TooltipContent>
      </Tooltip>
      <div className="hidden w-24 md:block">
        <Slider value={[muted ? 0 : volume]} onValueChange={(v) => applyVolume(v[0] ?? 0)} max={100} step={1} aria-label="Nivel de volumen" />
      </div>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" aria-label="Ajustes de calidad" onClick={() => toast.info("Selector de calidad demo", { description: "Calidad adaptativa según ancho de banda." })}>
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Calidad</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-foreground hover:bg-white/10" onClick={togglePip} aria-label="Picture in picture">
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
