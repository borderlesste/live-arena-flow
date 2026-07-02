import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlayerControlsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  shareUrl?: string;
  mediaControlsEnabled: boolean;
  mediaKey?: string;
  isLive?: boolean;
  streamSwitcher?: ReactNode;
}

interface MediaTimeline {
  current: number;
  duration: number;
  seekStart: number;
  canSeek: boolean;
}

const EMPTY_TIMELINE: MediaTimeline = { current: 0, duration: 0, seekStart: 0, canSeek: false };

export function PlayerControls({
  containerRef,
  shareUrl,
  mediaControlsEnabled,
  mediaKey,
  isLive = false,
  streamSwitcher,
}: PlayerControlsProps) {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(70);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [timeline, setTimeline] = useState<MediaTimeline>(EMPTY_TIMELINE);

  const mediaElement = useCallback(() => {
    return containerRef.current?.querySelector("video, audio") as HTMLMediaElement | null;
  }, [containerRef]);

  useEffect(() => {
    const media = mediaElement();
    const container = containerRef.current;
    if (!media || !container) {
      setPlaying(false);
      setTimeline(EMPTY_TIMELINE);
      return;
    }

    const activeMedia = media;

    function syncPlayback() {
      setPlaying(!activeMedia.paused && !activeMedia.ended);
    }

    function syncVolume() {
      setMuted(activeMedia.muted || activeMedia.volume === 0);
      setVolume(Math.round(activeMedia.volume * 100));
    }

    function syncTimeline() {
      const hasSeekableWindow = activeMedia.seekable.length > 0;
      const seekStart = hasSeekableWindow ? activeMedia.seekable.start(0) : 0;
      const seekEnd = hasSeekableWindow
        ? activeMedia.seekable.end(activeMedia.seekable.length - 1)
        : 0;
      const finiteDuration =
        Number.isFinite(activeMedia.duration) && activeMedia.duration > 0 ? activeMedia.duration : 0;
      const duration = finiteDuration || Math.max(0, seekEnd - seekStart);
      const current = Math.min(duration, Math.max(0, activeMedia.currentTime - seekStart));
      setTimeline({ current, duration, seekStart, canSeek: duration > 0 });
    }

    function syncFullscreen() {
      setFullscreen(document.fullscreenElement === container);
    }

    function onEnterPictureInPicture() {
      setPictureInPicture(true);
    }

    function onLeavePictureInPicture() {
      setPictureInPicture(false);
    }

    syncPlayback();
    syncVolume();
    syncTimeline();
    syncFullscreen();

    media.addEventListener("play", syncPlayback);
    media.addEventListener("pause", syncPlayback);
    media.addEventListener("ended", syncPlayback);
    media.addEventListener("timeupdate", syncTimeline);
    media.addEventListener("durationchange", syncTimeline);
    media.addEventListener("loadedmetadata", syncTimeline);
    media.addEventListener("progress", syncTimeline);
    media.addEventListener("volumechange", syncVolume);
    media.addEventListener("enterpictureinpicture", onEnterPictureInPicture);
    media.addEventListener("leavepictureinpicture", onLeavePictureInPicture);
    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      media.removeEventListener("play", syncPlayback);
      media.removeEventListener("pause", syncPlayback);
      media.removeEventListener("ended", syncPlayback);
      media.removeEventListener("timeupdate", syncTimeline);
      media.removeEventListener("durationchange", syncTimeline);
      media.removeEventListener("loadedmetadata", syncTimeline);
      media.removeEventListener("progress", syncTimeline);
      media.removeEventListener("volumechange", syncVolume);
      media.removeEventListener("enterpictureinpicture", onEnterPictureInPicture);
      media.removeEventListener("leavepictureinpicture", onLeavePictureInPicture);
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, [containerRef, mediaElement, mediaKey]);

  const timeLabel = (() => {
    const current = formatMediaTime(timeline.current);
    if (isLive) return current;
    return `${current} / ${formatMediaTime(timeline.duration)}`;
  })();

  async function togglePlayback() {
    const media = mediaElement();
    if (!media) { toast.info("La transmisión todavía no está disponible"); return; }
    try {
      if (media.paused) await media.play();
      else media.pause();
    } catch (error) {
      const errorName = error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
      if (errorName === "NotAllowedError") toast.error("El navegador bloqueó la reproducción");
      else if (errorName === "NotSupportedError") toast.warning("La transmisión todavía no está disponible");
      else toast.error("No se pudo iniciar la reproducción");
    }
  }

  function toggleMute() {
    const media = mediaElement();
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }

  function applyVolume(nextVolume: number) {
    const media = mediaElement();
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    if (!media) return;
    media.volume = nextVolume / 100;
    media.muted = nextVolume === 0;
  }

  function seek(nextTime: number) {
    const media = mediaElement();
    if (!media || !timeline.canSeek) return;
    media.currentTime = timeline.seekStart + nextTime;
    setTimeline((previous) => ({ ...previous, current: nextTime }));
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => toast.error("Pantalla completa no disponible"));
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function togglePictureInPicture() {
    const video = containerRef.current?.querySelector("video") as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<unknown>;
    } | null;
    if (!video?.requestPictureInPicture) { toast.info("PiP no disponible para este origen"); return; }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture?.().catch(() => {});
    } else {
      video.requestPictureInPicture().catch(() => toast.error("PiP rechazado por el navegador"));
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

  return (
    <div
      data-testid="player-controls"
      className="pointer-events-auto w-full bg-gradient-to-t from-black via-black/90 to-transparent px-2 pb-2 pt-10 sm:px-3 sm:pb-3 md:px-4"
    >
      <SliderPrimitive.Root
        value={[timeline.current]}
        min={0}
        max={Math.max(timeline.duration, 1)}
        step={0.1}
        disabled={!mediaControlsEnabled || !timeline.canSeek}
        onValueChange={(value) => seek(value[0] ?? 0)}
        className="group relative flex h-5 w-full touch-none select-none items-center disabled:cursor-default"
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/25 transition-[height] group-hover:h-1.5 group-focus-within:h-1.5">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label="Progreso de reproducción"
          className="block h-3.5 w-3.5 rounded-full bg-primary opacity-0 shadow-[0_0_0_3px_hsl(var(--primary)/0.2)] transition-opacity focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
        />
      </SliderPrimitive.Root>

      <div className="flex min-h-10 items-center gap-1 text-white sm:gap-2">
        <ControlButton
          label={playing ? "Pausar" : "Reproducir"}
          onClick={() => void togglePlayback()}
          disabled={!mediaControlsEnabled}
        >
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </ControlButton>

        <ControlButton
          label={muted ? "Activar sonido" : "Silenciar"}
          onClick={toggleMute}
          disabled={!mediaControlsEnabled}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </ControlButton>

        <div className="hidden w-24 items-center px-1 sm:flex md:w-28">
          <Slider
            value={[muted ? 0 : volume]}
            onValueChange={(value) => applyVolume(value[0] ?? 0)}
            disabled={!mediaControlsEnabled}
            max={100}
            step={1}
            aria-label="Nivel de volumen"
            className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/25"
          />
        </div>

        <div className="ml-1 flex min-w-0 items-center gap-2 text-xs font-medium tabular-nums sm:text-sm">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold">
              <span className="h-2 w-2 rounded-full bg-live" aria-hidden="true" />
              <span className="hidden min-[420px]:inline">EN VIVO</span>
            </span>
          ) : null}
          <span className="whitespace-nowrap text-white/85">{timeLabel}</span>
        </div>

        {streamSwitcher ? <div className="ml-1 hidden min-w-0 md:block">{streamSwitcher}</div> : null}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ControlButton
            label={pictureInPicture ? "Salir de picture in picture" : "Picture in picture"}
            onClick={togglePictureInPicture}
            disabled={!mediaControlsEnabled}
            className="hidden sm:inline-flex"
          >
            <PictureInPicture2 className="h-5 w-5" />
          </ControlButton>
          <ControlButton label="Compartir" onClick={() => void share()}>
            <Share2 className="h-5 w-5" />
          </ControlButton>
          <ControlButton label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-10 w-10 shrink-0 text-white hover:bg-white/15 hover:text-white", className)}
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function formatMediaTime(value: number): string {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
