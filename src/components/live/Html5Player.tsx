interface Html5PlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

export function Html5Player({ src, poster, className }: Html5PlayerProps) {
  return (
    <video
      src={src}
      poster={poster}
      muted
      playsInline
      controls
      className={className}
      aria-label="Reproductor de vídeo"
    />
  );
}
