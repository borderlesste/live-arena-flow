import { Play } from "lucide-react";
import { formatDuration, formatRelativeShort } from "@/lib/format";
import type { Highlight } from "@/types";

interface Props { highlight: Highlight }

export function VideoHighlightCard({ highlight }: Props) {
  return (
    <article className="surface-card group relative overflow-hidden rounded-xl">
      <div
        className="relative h-36 w-full"
        style={{ background: `linear-gradient(135deg, hsl(${highlight.imageHue} 80% 50% / 0.5), hsl(215 30% 8%))` }}
        aria-hidden="true"
      >
        <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] tabular-nums">
          {formatDuration(highlight.durationSec)}
        </span>
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/90 text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5" />
          </span>
        </div>
      </div>
      <div className="space-y-1 px-4 py-3">
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug">{highlight.title}</h3>
        <p className="text-xs text-muted-foreground">{formatRelativeShort(highlight.publishedAt)}</p>
      </div>
    </article>
  );
}
