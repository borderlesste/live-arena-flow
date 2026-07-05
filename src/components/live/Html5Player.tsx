import type { RefObject } from "react";

interface Html5PlayerProps {
  src: string;
  audioOnly?: boolean;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  videoRef?: RefObject<HTMLVideoElement>;
  onError?: () => void;
}

export function Html5Player({ src, audioOnly = false, poster, className, autoPlay = false, videoRef, onError }: Html5PlayerProps) {
  if (audioOnly) {
    return <audio src={src} controls={false} onError={onError} className={className} aria-label="Reproductor de audio" />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      playsInline
      controls={false}
      autoPlay={autoPlay}
      onError={onError}
      className={className}
      aria-label="Reproductor de vídeo"
    />
  );
}
