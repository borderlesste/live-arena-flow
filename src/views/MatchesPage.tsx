import { useEffect, useMemo, useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { useSportsWindow } from "@/hooks/useSportsData";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { matchesSearch } from "@/lib/match-search";
import { filterFinishedEvents, filterLiveEvents, filterMatches, filterUpcomingEvents, isLiveMatchStatus } from "@/lib/match-filters";
import { groupMatchesByDate, sortMatchesByDateAsc } from "@/lib/format";
import type { Competition, Match, Team } from "@/types";

function renderMatchCard(
  m: Match,
  getTeam: (id: string) => Team,
  competitions: Competition[],
) {
  const home = getTeam(m.homeTeamId);
  const away = getTeam(m.awayTeamId);
  const comp = competitions.find((c) => c.id === m.competitionId)!;
  if (isLiveMatchStatus(m.status)) return <LiveMatchCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
  if (m.status === "scheduled") return <UpcomingMatchCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
  if (m.status === "finished") return <ResultCard key={m.id} match={m} homeTeam={home} awayTeam={away} competition={comp} />;
  return null;
}

const MatchesPage = () => {
  useDocumentMeta({ title: "Partidos", description: "Partidos en vivo, próximos y resultados de todas las competiciones." });
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const routeSport = searchParams.get("sport") as MatchFilter | null;
  const [filter, setFilter] = useState<MatchFilter>(routeSport === "football" ? "football" : "all");
  const { bundle, isLoading, isError, refetch } = useSportsWindow();
  const { matches, competitions, teams } = bundle;
  const getTeam = (id: string) => teams.find((team) => team.id === id)!;

  useEffect(() => {
    if (routeSport === "football") setFilter("football");
  }, [routeSport]);

  const filtered = useMemo(() => {
    const byFilter = filterMatches(matches, filter);
    if (!query) return byFilter;
    return byFilter.filter((match) => matchesSearch(match, teams, competitions, query));
  }, [filter, matches, query, teams, competitions]);

  const sections = useMemo(() => {
    const liveMatches = filterLiveEvents(filtered);
    const upcomingMatches = filterUpcomingEvents(filtered);
    const finishedMatches = filterFinishedEvents(filtered);

    if (filter === "live") {
      return [{ title: null, groups: [{ key: "live", label: "En directo", matches: sortMatchesByDateAsc(liveMatches) }] }];
    }
    if (filter === "upcoming") {
      return [{ title: null, groups: groupMatchesByDate(upcomingMatches, { order: "asc" }) }];
    }
    if (filter === "finished") {
      return [{ title: null, groups: groupMatchesByDate(finishedMatches, { order: "desc" }) }];
    }

    const result: Array<{ title: string | null; groups: ReturnType<typeof groupMatchesByDate> }> = [];
    if (liveMatches.length > 0) {
      result.push({
        title: "En directo",
        groups: [{ key: "live", label: "Ahora", matches: sortMatchesByDateAsc(liveMatches) }],
      });
    }
    if (upcomingMatches.length > 0) {
      result.push({ title: "Próximos", groups: groupMatchesByDate(upcomingMatches, { order: "asc" }) });
    }
    if (finishedMatches.length > 0) {
      result.push({ title: "Finalizados", groups: groupMatchesByDate(finishedMatches, { order: "desc" }) });
    }
    return result;
  }, [filtered, filter]);

  const totalMatches = sections.reduce((count, section) => count + section.groups.reduce((n, group) => n + group.matches.length, 0), 0);

  function clearSearch() {
    setSearchParams({});
    setFilter("all");
  }

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Partidos</h1>
        <p className="text-sm text-muted-foreground">Filtra por deporte o por estado.</p>
      </header>
      {query ? <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Resultados para</span><strong>“{query}”</strong><Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={clearSearch} aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></Button></div> : null}
      <MatchFilters value={filter} onChange={setFilter} />
      {isLoading ? <SkeletonLoader className="h-72 w-full" /> : isError ? <ErrorState title="No se pudieron cargar los partidos" description="Comprueba la conexión con el proveedor deportivo." action={<Button onClick={() => void refetch()}>Reintentar</Button>} /> : totalMatches === 0 ? (
        <EmptyState title="Sin resultados" description={query ? `No hay partidos, equipos o competiciones que coincidan con “${query}”.` : "No hay partidos para este filtro."} />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title ?? "default"} className="space-y-6">
              {section.title ? <h2 className="font-display text-xl font-semibold">{section.title}</h2> : null}
              {section.groups.map((group) => (
                <div key={group.key} className="space-y-3">
                  {section.groups.length > 1 || filter === "all" || filter === "football" ? (
                    <h3 className="font-display text-lg font-semibold capitalize">{group.label}</h3>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {group.matches.map((m) => renderMatchCard(m, getTeam, competitions))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MatchesPage;
