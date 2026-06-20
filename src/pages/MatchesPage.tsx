import { useMemo, useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { matches, competitions, getTeam } from "@/data/mocks";
import { EmptyState } from "@/components/feedback/States";

const MatchesPage = () => {
  useDocumentMeta({ title: "Partidos", description: "Partidos en vivo, próximos y resultados de todas las competiciones." });
  const [filter, setFilter] = useState<MatchFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return matches;
    if (filter === "live") return matches.filter((m) => m.status === "live" || m.status === "halftime");
    if (filter === "upcoming") return matches.filter((m) => m.status === "scheduled");
    if (filter === "finished") return matches.filter((m) => m.status === "finished");
    return matches.filter((m) => m.sport === filter);
  }, [filter]);

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Partidos</h1>
        <p className="text-sm text-muted-foreground">Filtra por deporte o por estado.</p>
      </header>
      <MatchFilters value={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <EmptyState title="Sin resultados" description="No hay partidos para este filtro." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const home = getTeam(m.homeTeamId);
            const away = getTeam(m.awayTeamId);
            const comp = competitions.find((c) => c.id === m.competitionId)!;
            if (m.status === "live" || m.status === "halftime") return <LiveMatchCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
            if (m.status === "scheduled") return <UpcomingMatchCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
            if (m.status === "finished") return <ResultCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
            return null;
          })}
        </div>
      )}
    </section>
  );
};

export default MatchesPage;
