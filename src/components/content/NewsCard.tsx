import { formatRelativeShort } from "@/lib/format";
import { ImageOff } from "lucide-react";
import type { NewsArticle } from "@/types";

interface Props { article: NewsArticle }

export function NewsCard({ article }: Props) {
  const imageSource = article.image ?? article.coverImageUrl;
  return (
    <article className="surface-card group flex flex-col gap-3 overflow-hidden rounded-xl">
      {/* Cover image / gradient fallback */}
      <div className="relative h-40 w-full overflow-hidden bg-surface-2">
        {imageSource ? (
          <img
            src={imageSource}
            alt={article.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Hide broken image — gradient fallback shows through
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 30% 25%, hsl(${article.imageHue} 90% 60% / 0.4), hsl(${article.imageHue} 70% 30% / 0.2) 50%, hsl(215 30% 8%) 100%)`,
            }}
            aria-hidden="true"
          />
        )}
        {/* Dark overlay so the category badge is always readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
        <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] uppercase tracking-wider ring-1 ring-white/10 text-white/90">
          {article.category}
        </span>
      </div>

      <div className="space-y-1 px-4 pb-4">
        <h3 className="font-display text-base font-semibold leading-snug group-hover:text-primary line-clamp-2">
          {article.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeShort(article.publishedAt)}</p>
      </div>
    </article>
  );
}

/** Compact thumbnail used in lists (admin panel, etc.) */
export function NewsThumb({ article, className }: { article: NewsArticle; className?: string }) {
  const imageSource = article.image ?? article.coverImageUrl;
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-lg ${className ?? ""}`}
      style={
        imageSource
          ? undefined
          : {
              background: `radial-gradient(circle at 40% 40%, hsl(${article.imageHue} 80% 55% / 0.5), hsl(${article.imageHue} 60% 25% / 0.3) 60%, hsl(215 30% 8%) 100%)`,
            }
      }
    >
      {imageSource ? (
        <img
          src={imageSource}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            (e.currentTarget.parentElement as HTMLElement).style.background = `radial-gradient(circle at 40% 40%, hsl(${article.imageHue} 80% 55% / 0.5), hsl(${article.imageHue} 60% 25% / 0.3) 60%, hsl(215 30% 8%) 100%)`;
          }}
        />
      ) : (
        <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground/30" aria-hidden="true" />
      )}
    </div>
  );
}
