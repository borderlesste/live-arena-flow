import { useEffect, useMemo, useRef, useState } from "react";
import { LivePlayer } from "@/components/live/LivePlayer";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { AgendaMatchCard } from "@/components/matches/AgendaMatchCard";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { SponsorCarousel, SponsorLogo } from "@/components/sponsors/SponsorCarousel";
import { AdvertisementSlot } from "@/components/sponsors/AdvertisementSlot";
import { CompetitionCard } from "@/components/competitions/CompetitionCard";
import { NewsCard } from "@/components/content/NewsCard";
import { NewsArticleDialog } from "@/components/content/NewsArticleDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageCircle, ChevronRight, MapPin, CalendarDays, Bell, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { useSportsWindow } from "@/hooks/useSportsData";
import { useContentData } from "@/hooks/useContentData";
import { toast } from "sonner";
import { formatMatchDate } from "@/lib/format";
import { useFavoriteMatch } from "@/hooks/useFavoriteMatch";
import { filterMatches } from "@/lib/match-filters";
import type { NewsArticle } from "@/types";

const HomePage = () => {
  useDocumentMeta({
    title: "Inicio",
    description: "Mira deporte en vivo, sigue partidos, marcadores, próximos eventos y conecta con la comunidad.",
  });

  const { bundle, isLoading, isError, refetch } = useSportsWindow();
  const { news: allNews, sponsors: allSponsors, isLoading: isContentLoading } = useContentData();
  const latestNews = useMemo(() => [...allNews].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)), [allNews]);
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const live = bundle.matches.filter((match) => ["live", "halftime", "paused"].includes(match.status));
  const upcoming = bundle.matches.filter((match) => match.status === "scheduled").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const finished = bundle.matches.filter((match) => match.status === "finished").sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const allCompetitions = bundle.competitions;
  const getTeam = (id: string) => bundle.teams.find((team) => team.id === id)!;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Split sponsors: main tier → slot under player; rest → slot under news
  const mainSponsors = allSponsors.filter((s) => s.tier === "main" || s.tier === "official");
  const partnerSponsors = allSponsors.filter((s) => s.tier === "partner");

  const featured = [...live, ...upcoming, ...finished];

  // Prefer the match that contains a source marked as primary. If none exists,
  // fallback to the first live match.
  const primaryMatchId = useMemo(() => featured.find((m) => (m.streams || []).some((s) => s.isPrimary))?.id, [featured]);

  const [activeId, setActiveId] = useState<string | undefined>(primaryMatchId ?? live[0]?.id);
  const activeMatch = featured.find((match) => match.id === activeId) ?? featured[0];
  const homeTeam = activeMatch ? getTeam(activeMatch.homeTeamId) : null;
  const awayTeam = activeMatch ? getTeam(activeMatch.awayTeamId) : null;
  const competition = activeMatch ? allCompetitions.find((c) => c.id === activeMatch.competitionId) : null;
  const playableMatch = activeMatch ? { ...activeMatch, streams: activeMatch.streams.length > 0 ? activeMatch.streams : activeMatch.highlights ?? [] } : null;
  const favoriteMatch = useFavoriteMatch(activeMatch?.id);

  const [filter, setFilter] = useState<MatchFilter>("all");
  const filteredMatches = useMemo(() => {
    const matches = [...live, ...upcoming, ...finished];
    return filterMatches(matches, filter);
  }, [filter, live, upcoming, finished]);
  const filterTitle = filter === "live" ? "Jugando ahora" : filter === "upcoming" ? "Próximos partidos" : filter === "finished" ? "Resultados recientes" : "Partidos destacados";
  const emptyTitle = filter === "live" ? "No hay partidos en directo" : filter === "upcoming" ? "No hay próximos partidos" : filter === "finished" ? "No hay resultados recientes" : "No hay partidos para este filtro";
  const visibleFilteredMatches = filteredMatches.slice(0, 9);

  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Move focus to active title (without scrolling) when stream changes
    titleRef.current?.focus({ preventScroll: true });
  }, [activeId]);

  // Always switch the hero to the primary match if one is present.
  useEffect(() => {
    if (!primaryMatchId) return;
    if (activeId !== primaryMatchId) setActiveId(primaryMatchId);
  }, [primaryMatchId, activeId]);

  if (isLoading || isContentLoading) return <section className="container mx-auto px-4 py-8 md:px-6"><SkeletonLoader className="h-[520px] w-full" /></section>;

  if (isError) return <section className="container mx-auto px-4 py-12 md:px-6"><ErrorState title="No se pudieron cargar los partidos" description="El proveedor deportivo no respondió correctamente." action={<Button onClick={() => void refetch()}>Reintentar</Button>} /></section>;

  if (!activeMatch || !homeTeam || !awayTeam || !competition) {
    return (
      <section className="container mx-auto px-4 py-12 md:px-6">
        <EmptyState title="No hay partidos en directo" description="Vuelve a consultar próximamente o revisa los próximos eventos." />
      </section>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* HERO */}
      <section aria-label="Partido destacado" className="bg-gradient-hero">
        <div className="container mx-auto px-4 py-6 md:px-6 lg:py-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:gap-6">
            <div className="flex min-w-0 flex-col gap-4">
              <LivePlayer
                match={playableMatch!}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                competitionName={competition.name}
              />

              {/* Match summary */}
              <div className="surface-card rounded-xl p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{competition.name} · {competition.region}</p>
                    <h1 ref={titleRef} tabIndex={-1} className="font-display text-xl font-bold leading-tight outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-2xl">
                      {homeTeam.name} <span className="text-muted-foreground">vs</span> {awayTeam.name}
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{activeMatch.venue}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatMatchDate(activeMatch.startsAt)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="font-display text-3xl font-bold tabular-nums md:text-4xl">
                      {activeMatch.homeScore} <span className="text-muted-foreground">·</span> {activeMatch.awayScore}
                    </span>
                    <span className="text-xs text-muted-foreground">{activeMatch.clock ?? (activeMatch.status === "finished" ? "Finalizado" : activeMatch.status === "scheduled" ? "Programado" : "En curso")}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {favoriteMatch.available ? <Button size="sm" variant="outline" onClick={() => void favoriteMatch.toggle().then((next) => toast.success(next ? "Partido añadido a favoritos" : "Partido retirado de favoritos")).catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo actualizar"))}>
                    <Bell className="mr-1.5 h-4 w-4" /> {favoriteMatch.favorite ? "Siguiendo" : "Seguir partido"}
                  </Button> : null}
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try { await navigator.clipboard.writeText(window.location.href); toast.success("Enlace copiado"); }
                    catch { toast.error("No se pudo copiar"); }
                  }}>
                    <Share2 className="mr-1.5 h-4 w-4" /> Compartir
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="ml-auto">
                    <Link to={`/match/${activeMatch.id}`}>Ver detalles <ChevronRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>

              {/* Banner ad slot under the player */}
              <AdvertisementSlot
                variant="banner"
                sponsors={mainSponsors.length > 0 ? mainSponsors : allSponsors.slice(0, 2)}
              />
            </div>

            {/* Chat */}
            {isDesktop ? (
              <ChatPanel className="h-full max-h-[680px]" roomKey={activeMatch.id} matchTitle={`${homeTeam.shortName} vs ${awayTeam.shortName}`} />
            ) : (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="mr-2 h-4 w-4" /> Abrir chat en vivo
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] bg-card p-0">
                  <SheetHeader className="border-b border-border px-4 py-3">
                    <SheetTitle className="text-left font-display">Chat en vivo</SheetTitle>
                  </SheetHeader>
                  <div className="h-[calc(85vh-57px)]">
                    <ChatPanel className="h-full rounded-none border-0" roomKey={activeMatch.id} matchTitle={`${homeTeam.shortName} vs ${awayTeam.shortName}`} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </section>

      {/* JUGANDO AHORA */}
      <section aria-labelledby="jugando-ahora" className="container mx-auto px-4 md:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary">Datos deportivos</p>
            <h2 id="jugando-ahora" className="font-display text-2xl font-bold">{filterTitle}</h2>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/matches">Ver todo <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <MatchFilters value={filter} onChange={setFilter} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.length === 0 ? (
            <EmptyState className="sm:col-span-2 lg:col-span-3" title={emptyTitle} description="La lista se actualiza directamente desde el proveedor deportivo." />
          ) : visibleFilteredMatches.map((match) => {
            const teamHome = getTeam(match.homeTeamId);
            const teamAway = getTeam(match.awayTeamId);
            const matchCompetition = allCompetitions.find((item) => item.id === match.competitionId)!;
            if (["live", "halftime", "paused"].includes(match.status)) return <LiveMatchCard key={match.id} match={match} homeTeam={teamHome} awayTeam={teamAway} competition={matchCompetition} isActive={match.id === activeId} onSelect={setActiveId} />;
            if (match.status === "finished") return <ResultCard key={match.id} match={match} homeTeam={teamHome} awayTeam={teamAway} competition={matchCompetition} />;
            return <UpcomingMatchCard key={match.id} match={match} homeTeam={teamHome} awayTeam={teamAway} competition={matchCompetition} />;
          })}
        </div>
      </section>

      {/* PRÓXIMOS */}
      <section aria-labelledby="proximos" className="container mx-auto px-4 md:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="proximos" className="font-display text-2xl font-bold">Próximos partidos</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/calendar">Calendario completo <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.length === 0 ? <EmptyState className="sm:col-span-2 lg:col-span-3" title="No hay próximos partidos" description="El proveedor no devolvió eventos programados en la ventana consultada." /> : upcoming.slice(0, 6).map((m) => (
            <UpcomingMatchCard key={m.id} match={m} homeTeam={getTeam(m.homeTeamId)} awayTeam={getTeam(m.awayTeamId)} competition={allCompetitions.find((c) => c.id === m.competitionId)!} />
          ))}
        </div>
      </section>

      {/* RESULTADOS */}
      <section aria-labelledby="resultados" className="container mx-auto px-4 md:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="resultados" className="font-display text-2xl font-bold">Resultados</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/results">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {finished.length === 0 ? <EmptyState className="lg:col-span-2" title="No hay resultados recientes" description="El proveedor no devolvió partidos finalizados en la ventana consultada." /> : finished.slice(0, 4).map((m) => (
            <ResultCard key={m.id} match={m} homeTeam={getTeam(m.homeTeamId)} awayTeam={getTeam(m.awayTeamId)} competition={allCompetitions.find((c) => c.id === m.competitionId)!} />
          ))}
        </div>
      </section>

      {/* PATROCINADORES */}
      <section aria-labelledby="patrocinadores" className="container mx-auto px-4 md:px-6">
        <h2 id="patrocinadores" className="mb-4 font-display text-2xl font-bold">Patrocinadores oficiales</h2>
        {allSponsors.length === 0 ? <EmptyState title="Sin patrocinadores publicados" description="El backend aún no tiene patrocinadores activos." /> : <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
          <SponsorLogo sponsor={allSponsors[0]} />
          <SponsorCarousel sponsors={allSponsors.slice(1)} />
        </div>}
      </section>

      {/* COMPETICIONES + POSICIONES */}
      <section aria-labelledby="competiciones" className="container mx-auto grid gap-6 px-4 md:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="competiciones" className="mb-4 font-display text-2xl font-bold">Competiciones</h2>
          <div className="space-y-3">
            {allCompetitions.slice(0, 3).map((c) => <CompetitionCard key={c.id} competition={c} />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="surface-card rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-primary">SportSRC</p>
            <p className="mt-1 font-display text-xl font-bold">Datos deportivos conectados</p>
            <p className="mt-2 text-sm text-muted-foreground">{bundle.matches.length} eventos, {bundle.teams.length} equipos y {bundle.competitions.length} competiciones cargados desde la API.</p>
          </div>
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary">Partidos programados</p>
                <h3 className="font-display text-xl font-bold">Agenda destacada</h3>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/calendar">Ver calendario <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link>
              </Button>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState title="Sin partidos programados" description="La agenda se actualizará cuando el proveedor publique nuevos encuentros." />
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 3).map((match) => (
                  <AgendaMatchCard
                    key={match.id}
                    match={match}
                    homeTeam={getTeam(match.homeTeamId)}
                    awayTeam={getTeam(match.awayTeamId)}
                    competition={allCompetitions.find((item) => item.id === match.competitionId)!}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* NOTICIAS + HIGHLIGHTS */}
      <section aria-labelledby="contenido" className="container mx-auto space-y-8 px-4 md:px-6">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="contenido" className="font-display text-2xl font-bold">Últimas noticias</h2>
            <Button asChild variant="outline" size="sm"><Link to="/noticias">Ver todas <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link></Button>
          </div>
          {allNews.length === 0 ? <EmptyState title="Sin noticias publicadas" description="El contenido aparecerá cuando se publique desde el backend." /> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {latestNews.slice(0, 3).map((n) => <NewsCard key={n.id} article={n} onRead={setSelectedNews} />)}
          </div>}
        </div>
        <AdvertisementSlot
          variant="banner"
          sponsors={partnerSponsors.length > 0 ? partnerSponsors : allSponsors.slice(2)}
        />
      </section>
      <NewsArticleDialog article={selectedNews} onOpenChange={(open) => { if (!open) setSelectedNews(null); }} />
    </div>
  );
};

export default HomePage;
