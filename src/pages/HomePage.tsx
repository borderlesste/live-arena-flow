import { useEffect, useMemo, useRef, useState } from "react";
import { LivePlayer } from "@/components/live/LivePlayer";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { SponsorCarousel, SponsorLogo } from "@/components/sponsors/SponsorCarousel";
import { AdvertisementSlot } from "@/components/sponsors/AdvertisementSlot";
import { CompetitionCard } from "@/components/competitions/CompetitionCard";
import { NewsCard } from "@/components/content/NewsCard";
import { VideoHighlightCard } from "@/components/content/VideoHighlightCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageCircle, ChevronRight, MapPin, CalendarDays, Bell, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getLiveMatches, getUpcomingMatches, getFinishedMatches,
} from "@/services/matches.service";
import { competitions as allCompetitions, getTeam, standings, news as allNews, highlights as allHighlights, sponsors as allSponsors } from "@/data/mocks";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { StandingsTable } from "@/components/competitions/StandingsTable";
import { EmptyState } from "@/components/feedback/States";
import { toast } from "sonner";
import { formatMatchDate } from "@/lib/format";

const HomePage = () => {
  useDocumentMeta({
    title: "Inicio",
    description: "Mira deporte en vivo, sigue partidos, marcadores, próximos eventos y conecta con la comunidad.",
  });

  const live = getLiveMatches();
  const upcoming = getUpcomingMatches();
  const finished = getFinishedMatches();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [activeId, setActiveId] = useState(live[0]?.id);
  const activeMatch = useMemo(() => live.find((m) => m.id === activeId) ?? live[0], [activeId, live]);
  const homeTeam = activeMatch ? getTeam(activeMatch.homeTeamId) : null;
  const awayTeam = activeMatch ? getTeam(activeMatch.awayTeamId) : null;
  const competition = activeMatch ? allCompetitions.find((c) => c.id === activeMatch.competitionId) : null;

  const [filter, setFilter] = useState<MatchFilter>("all");
  const filteredLive = useMemo(() => {
    if (filter === "all" || filter === "live") return live;
    if (filter === "upcoming") return [];
    if (filter === "finished") return [];
    return live.filter((m) => m.sport === filter);
  }, [filter, live]);

  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Move focus to active title (without scrolling) when stream changes
    titleRef.current?.focus({ preventScroll: true });
  }, [activeId]);

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
      <section aria-label="Partido en directo" className="bg-gradient-hero">
        <div className="container mx-auto px-4 py-6 md:px-6 lg:py-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:gap-6">
            <div className="flex flex-col gap-4">
              <LivePlayer
                match={activeMatch}
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
                    <span className="text-xs text-muted-foreground">{activeMatch.clock ?? "En curso"}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success("Siguiendo partido")}>
                    <Bell className="mr-1.5 h-4 w-4" /> Seguir partido
                  </Button>
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
              <AdvertisementSlot variant="banner" />
            </div>

            {/* Chat */}
            {isDesktop ? (
              <ChatPanel className="h-full max-h-[680px]" matchTitle={`${homeTeam.shortName} vs ${awayTeam.shortName}`} />
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
                    <ChatPanel className="h-full rounded-none border-0" matchTitle={`${homeTeam.shortName} vs ${awayTeam.shortName}`} />
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
            <p className="text-xs uppercase tracking-wider text-primary">Ahora mismo</p>
            <h2 id="jugando-ahora" className="font-display text-2xl font-bold">Jugando ahora</h2>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/live">Ver todo <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <MatchFilters value={filter} onChange={setFilter} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLive.length === 0 ? (
            <EmptyState className="sm:col-span-2 lg:col-span-3" title="Sin partidos en directo en este filtro" description="Cambia el filtro o consulta los próximos partidos." />
          ) : filteredLive.map((m) => (
            <LiveMatchCard
              key={m.id}
              match={m}
              homeTeam={getTeam(m.homeTeamId)}
              awayTeam={getTeam(m.awayTeamId)}
              competition={allCompetitions.find((c) => c.id === m.competitionId)!}
              isActive={m.id === activeId}
              onSelect={setActiveId}
            />
          ))}
        </div>
      </section>

      {/* PRÓXIMOS */}
      <section aria-labelledby="proximos" className="container mx-auto px-4 md:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="proximos" className="font-display text-2xl font-bold">Próximos partidos</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/calendar">Calendario completo <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.slice(0, 6).map((m) => (
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
          {finished.slice(0, 4).map((m) => (
            <ResultCard key={m.id} match={m} homeTeam={getTeam(m.homeTeamId)} awayTeam={getTeam(m.awayTeamId)} competition={allCompetitions.find((c) => c.id === m.competitionId)!} />
          ))}
        </div>
      </section>

      {/* PATROCINADORES */}
      <section aria-labelledby="patrocinadores" className="container mx-auto px-4 md:px-6">
        <h2 id="patrocinadores" className="mb-4 font-display text-2xl font-bold">Patrocinadores oficiales</h2>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
          <SponsorLogo sponsor={allSponsors[0]} />
          <SponsorCarousel sponsors={allSponsors.slice(1)} />
        </div>
      </section>

      {/* COMPETICIONES + POSICIONES */}
      <section aria-labelledby="competiciones" className="container mx-auto grid gap-6 px-4 md:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="competiciones" className="mb-4 font-display text-2xl font-bold">Competiciones</h2>
          <div className="space-y-3">
            {allCompetitions.slice(0, 3).map((c) => <CompetitionCard key={c.id} competition={c} />)}
          </div>
        </div>
        <div>
          <h2 className="mb-4 font-display text-2xl font-bold">Liga Continental — Tabla</h2>
          <StandingsTable rows={standings["liga-continental"]} />
        </div>
      </section>

      {/* NOTICIAS + HIGHLIGHTS */}
      <section aria-labelledby="contenido" className="container mx-auto space-y-8 px-4 md:px-6">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="contenido" className="font-display text-2xl font-bold">Últimas noticias</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allNews.slice(0, 6).map((n) => <NewsCard key={n.id} article={n} />)}
          </div>
        </div>
        <div>
          <h2 className="mb-4 font-display text-2xl font-bold">Destacados</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allHighlights.map((h) => <VideoHighlightCard key={h.id} highlight={h} />)}
          </div>
        </div>
        <AdvertisementSlot variant="banner" />
      </section>
    </div>
  );
};

export default HomePage;
