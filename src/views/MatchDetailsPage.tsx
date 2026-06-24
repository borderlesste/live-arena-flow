import { Link, useParams } from "react-router-dom";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useMatchData } from "@/hooks/useSportsData";
import { LivePlayer } from "@/components/live/LivePlayer";
import { Scoreboard } from "@/components/live/Scoreboard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EmptyState } from "@/components/feedback/States";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageCircle, MapPin, CalendarDays } from "lucide-react";
import { formatMatchDate } from "@/lib/format";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";

const MatchDetailsPage = () => {
  const { id } = useParams();
  const { bundle, isLoading } = useMatchData(id);
  const match = bundle.matches[0];
  const home = match ? bundle.teams.find((team) => team.id === match.homeTeamId) : null;
  const away = match ? bundle.teams.find((team) => team.id === match.awayTeamId) : null;
  const comp = match ? bundle.competitions.find((competition) => competition.id === match.competitionId) : null;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useDocumentMeta({
    title: match && home && away ? `${home.name} vs ${away.name}` : "Partido",
    description: match ? `Detalles, marcador y resumen del partido.` : undefined,
  });

  if (isLoading) return <section className="container mx-auto px-4 py-8"><SkeletonLoader className="h-96 w-full" /></section>;

  if (!match || !home || !away || !comp) {
    return (
      <section className="container mx-auto px-4 py-12">
        <EmptyState title="Partido no encontrado" description="El partido solicitado no existe." action={<Button asChild><Link to="/matches">Ver partidos</Link></Button>} />
      </section>
    );
  }

  const playbackSources = match.streams.length > 0 ? match.streams : match.highlights ?? [];
  const canShow = playbackSources.length > 0;
  const playableMatch = { ...match, streams: playbackSources };

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-primary">{comp.name}</p>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{home.name} vs {away.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{match.venue}</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatMatchDate(match.startsAt)}</span>
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {canShow ? (
            <div id={match.streams.length > 0 ? "replay" : "summary"}><LivePlayer match={playableMatch} homeTeam={home} awayTeam={away} competitionName={comp.name} /></div>
          ) : (
            <div className="surface-card grid h-72 place-items-center rounded-xl text-muted-foreground">Reproducción no disponible para este partido</div>
          )}
          <Scoreboard match={match} homeTeam={home} awayTeam={away} competitionName={comp.name} variant="panel" />
        </div>
        {isDesktop ? (
          <ChatPanel className="h-full max-h-[680px]" roomKey={match.id} matchTitle={`${home.shortName} vs ${away.shortName}`} />
        ) : (
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" className="w-full"><MessageCircle className="mr-2 h-4 w-4" /> Chat en vivo</Button></SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] bg-card p-0">
              <SheetHeader className="border-b border-border px-4 py-3"><SheetTitle>Chat</SheetTitle></SheetHeader>
              <div className="h-[calc(85vh-57px)]"><ChatPanel className="h-full rounded-none border-0" roomKey={match.id} /></div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </section>
  );
};

export default MatchDetailsPage;
