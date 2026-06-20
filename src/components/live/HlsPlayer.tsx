import { useEffect, useRef, useState } from "react";

interface HlsPlayerProps {
  src: string;
  poster?: string;
  muted?: boolean;
  autoPlay?: boolean;
  onStatusChange?: (status: "loading" | "playing" | "buffering" | "error") => void;
  className?: string;
}

/**
 * HLS player. Uses native playback in Safari, dynamic imports hls.js otherwise.
 * Always cleans up the Hls instance on unmount or src change.
 * Never auto-plays with sound.
 */
export function HlsPlayer({ src, poster, muted = true, autoPlay = true, onStatusChange, className }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: import("hls.js").default | null = null;
    let disposed = false;
    onStatusChange?.("loading");

    const canNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (canNative) {
      video.src = src;
      const onCanPlay = () => onStatusChange?.("playing");
      const onWaiting = () => onStatusChange?.("buffering");
      const onError = () => onStatusChange?.("error");
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("waiting", onWaiting);
      video.addEventListener("error", onError);
      if (autoPlay) video.play().catch(() => {/* user gesture required */});
      return () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      };
    }

    (async () => {
      const mod = await import("hls.js");
      if (disposed) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) { onStatusChange?.("error"); return; }
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onStatusChange?.("playing");
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          onStatusChange?.("error");
          try { hls?.destroy(); } catch { /* noop */ }
        }
      });
      force((x) => x + 1);
    })();

    return () => {
      disposed = true;
      try { hls?.destroy(); } catch { /* noop */ }
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      muted={muted}
      playsInline
      controls={false}
      className={className}
      aria-label="Reproductor de vídeo en vivo"
    />
  );
}
