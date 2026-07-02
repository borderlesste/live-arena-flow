interface Html5PlayerProps {
  src: string;
  audioOnly?: boolean;
  poster?: string;
  className?: string;
  onError?: () => void;
}

export function Html5Player({ src, audioOnly = false, poster, className, onError }: Html5PlayerProps) {
  if (audioOnly) {
    return <audio src={src} controls={false} onError={onError} className={className} aria-label="Reproductor de audio" />;
  }
  return (
    <video
      src={src}
      poster={poster}
      muted
      playsInline
      controls={false}
      onError={onError}
      className={className}
      aria-label="Reproductor de vídeo"
    />
  );
}
