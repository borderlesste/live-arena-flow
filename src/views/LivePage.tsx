import { useMemo, useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { LivePlayer } from "@/components/live/LivePlayer";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useLiveSportsWindow } from "@/hooks/useSportsData";
import { EmptyState } from "@/components/feedback/States";

const LivePage = () => {
  useDocumentMeta({ title: "En vivo", description: "Todas las transmisiones deportivas en directo, en un solo lugar." });
  const { bundle } = useLiveSportsWindow();
  const live = bundle.matches.filter((match) => ["live", "halftime", "paused"].includes(match.status));
  const competitions = bundle.competitions;
  const getTeam = (id: string) => bundle.teams.find((team) => team.id === id)!;
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [activeId, setActiveId] = useState(live[0]?.id);
  const [filter, setFilter] = useState<MatchFilter>("live");
  const active = useMemo(() => live.find((m) => m.id === activeId) ?? live[0], [activeId, live]);

  if (!active) {
    return <section className="container mx-auto px-4 py-12"><EmptyState title="Sin transmisiones activas" description="Vuelve más tarde." /></section>;
  }
  const home = getTeam(active.homeTeamId);
  const away = getTeam(active.awayTeamId);
  const comp = competitions.find((c) => c.id === active.competitionId)!;

  const filtered = filter === "all" || filter === "live" ? live : live.filter((m) => m.sport === filter);

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-primary">Ahora en directo</p>
        <h1 className="font-display text-3xl font-bold">Transmisiones en vivo</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
        <LivePlayer match={active} homeTeam={home} awayTeam={away} competitionName={comp.name} />
        {isDesktop ? (
          <ChatPanel className="h-full max-h-[680px]" roomKey={active.id} matchTitle={`${home.shortName} vs ${away.shortName}`} />
        ) : (
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" className="w-full"><MessageCircle className="mr-2 h-4 w-4" /> Chat en vivo</Button></SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] bg-card p-0">
              <SheetHeader className="border-b border-border px-4 py-3"><SheetTitle className="text-left">Chat</SheetTitle></SheetHeader>
              <div className="h-[calc(85vh-57px)]"><ChatPanel className="h-full rounded-none border-0" roomKey={active.id} /></div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <MatchFilters value={filter} onChange={setFilter} showStatusFilters={false} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <LiveMatchCard
            key={m.id}
            match={m}
            homeTeam={getTeam(m.homeTeamId)}
            awayTeam={getTeam(m.awayTeamId)}
            competition={competitions.find((c) => c.id === m.competitionId)!}
            isActive={m.id === active.id}
            onSelect={setActiveId}
          />
        ))}
      </div>
    </section>
  );
};

export default LivePage;
