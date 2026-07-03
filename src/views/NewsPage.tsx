import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { NewsArticleDialog } from "@/components/content/NewsArticleDialog";
import { NewsCard } from "@/components/content/NewsCard";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useNewsData } from "@/hooks/useNewsData";
import type { NewsArticle } from "@/types";

const PAGE_SIZE = 9;

export default function NewsPage() {
  useDocumentMeta({ title: "Noticias de fútbol", description: "Actualidad, análisis y resultados del fútbol nacional e internacional." });
  const { news, isLoading, isError, refetch } = useNewsData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const pageCount = Math.max(1, Math.ceil(news.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(searchParams.get("pagina") ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const pageArticles = useMemo(() => news.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [news, page]);

  function goToPage(nextPage: number) {
    const normalized = Math.min(Math.max(nextPage, 1), pageCount);
    setSearchParams(normalized === 1 ? {} : { pagina: String(normalized) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8 md:px-6 lg:py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Actualidad futbolística</p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">Noticias de fútbol</h1>
        <p className="mt-3 text-muted-foreground">Las noticias más recientes, análisis, entrevistas y resultados en un solo lugar.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <SkeletonLoader key={index} className="h-[340px] w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <ErrorState
          title="No se pudieron cargar las noticias"
          description="Intenta nuevamente en unos segundos."
          action={<Button type="button" variant="outline" onClick={() => void refetch()}>Reintentar</Button>}
        />
      ) : news.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-8 w-8" />} title="Sin noticias publicadas" description="Las nuevas publicaciones aparecerán aquí." />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pageArticles.map((article) => <NewsCard key={article.id} article={article} onRead={setSelectedArticle} />)}
          </div>

          {pageCount > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="Paginación de noticias">
              <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => goToPage(page - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Anterior
              </Button>
              <span className="px-3 text-sm text-muted-foreground" aria-live="polite">Página {page} de {pageCount}</span>
              <Button type="button" variant="outline" size="sm" disabled={page === pageCount} onClick={() => goToPage(page + 1)}>
                Siguiente <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </>
      )}

      <NewsArticleDialog article={selectedArticle} onOpenChange={(open) => { if (!open) setSelectedArticle(null); }} />
    </div>
  );
}
