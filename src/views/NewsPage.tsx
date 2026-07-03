import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Newspaper, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { NewsArticleDialog } from "@/components/content/NewsArticleDialog";
import { NewsCard } from "@/components/content/NewsCard";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useNewsData } from "@/hooks/useNewsData";
import type { NewsArticle } from "@/types";

const PAGE_SIZE = 9;

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export default function NewsPage() {
  useDocumentMeta({ title: "Noticias de fútbol", description: "Actualidad, análisis y resultados del fútbol nacional e internacional." });
  const { news, isLoading, isError, refetch } = useNewsData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query.trim());
  const filteredNews = useMemo(() => {
    if (!normalizedQuery) return news;

    return news.filter((article) => normalizeSearchText([
      article.title,
      article.excerpt,
      article.body,
      article.category,
      article.sponsorName,
    ].filter(Boolean).join(" ")).includes(normalizedQuery));
  }, [news, normalizedQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredNews.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(searchParams.get("pagina") ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const pageArticles = useMemo(() => filteredNews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredNews, page]);

  function updateQuery(value: string) {
    setQuery(value);
    setSearchParams({}, { replace: true });
  }

  function goToPage(nextPage: number) {
    const normalized = Math.min(Math.max(nextPage, 1), pageCount);
    setSearchParams(normalized === 1 ? {} : { pagina: String(normalized) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8 md:px-6 lg:py-12">
      <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Actualidad futbolística</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">Noticias de fútbol</h1>
          <p className="mt-3 text-muted-foreground">Las noticias más recientes, análisis, entrevistas y resultados en un solo lugar.</p>
        </div>
        <div className="relative md:mb-1">
          <label htmlFor="news-search" className="sr-only">Buscar noticias</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="news-search"
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Buscar noticias..."
            autoComplete="off"
            className="h-11 rounded-lg bg-card pl-10 pr-10"
          />
          {query ? (
            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => updateQuery("")} aria-label="Limpiar búsqueda">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
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
      ) : filteredNews.length === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" />} title="No encontramos noticias" description={`No hay resultados para “${query.trim()}”. Prueba con otro término.`} />
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
