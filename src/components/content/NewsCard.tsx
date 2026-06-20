import { formatRelativeShort } from "@/lib/format";
import type { NewsArticle } from "@/types";

interface Props { article: NewsArticle }

export function NewsCard({ article }: Props) {
  return (
    <article className="surface-card group flex flex-col gap-3 overflow-hidden rounded-xl">
      <div
        className="relative h-36 w-full"
        style={{ background: `radial-gradient(circle at 30% 25%, hsl(${article.imageHue} 90% 60% / 0.4), hsl(${article.imageHue} 70% 30% / 0.2) 50%, hsl(215 30% 8%) 100%)` }}
        aria-hidden="true"
      >
        <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] uppercase tracking-wider ring-1 ring-white/10">
          {article.category}
        </span>
      </div>
      <div className="space-y-1 px-4 pb-4">
        <h3 className="font-display text-base font-semibold leading-snug group-hover:text-primary">{article.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeShort(article.publishedAt)}</p>
      </div>
    </article>
  );
}
