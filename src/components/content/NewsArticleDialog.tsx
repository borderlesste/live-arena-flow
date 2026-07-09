import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NewsArticle } from "@/types";

interface NewsArticleDialogProps {
  article: NewsArticle | null;
  onOpenChange: (open: boolean) => void;
}

export function NewsArticleDialog({ article, onOpenChange }: NewsArticleDialogProps) {
  const imageSource = article?.image ?? article?.coverImageUrl;

  return (
    <Dialog open={Boolean(article)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        {article ? (
          <article>
            {imageSource ? (
              <div className="relative h-56 w-full sm:h-72">
                <Image src={imageSource} alt="" fill unoptimized sizes="(min-width: 640px) 768px, 100vw" className="object-cover" />
              </div>
            ) : null}
            <div className="space-y-5 p-6 sm:p-8">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{article.category}</span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {new Date(article.publishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                {article.isSponsored ? (
                  <div className="w-fit rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                    <strong>Contenido patrocinado</strong> · Presentado por {article.sponsorName}
                  </div>
                ) : null}
                <DialogTitle className="font-display text-2xl leading-tight sm:text-3xl">{article.title}</DialogTitle>
                <DialogDescription className="text-base leading-relaxed">{article.excerpt}</DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/90 sm:text-base">
                {article.body?.trim() || article.excerpt}
              </div>
            </div>
          </article>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
