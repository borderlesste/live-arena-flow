import { useMemo } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useWorldChampionshipData } from "@/hooks/useSportsData";
import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { groupMatchesByDate } from "@/lib/format";
import { isLiveMatchStatus } from "@/lib/match-filters";
import {
  filterWorldChampionshipMatches,
  isWorldChampionshipCompetition,
  splitWorldChampionshipTimeline,
  WORLD_CHAMPIONSHIP_NAME,
} from "@/lib/world-championship";
import type { Competition, Match, Team } from "@/types";

function renderMatchCard(
  match: Match,
  getTeam: (id: string) => Team,
  competition: Competition,
) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);

  if (isLiveMatchStatus(match.status)) {
    return <LiveMatchCard key={match.id} match={match} homeTeam={home} awayTeam={away} competition={competition} />;
  }
  if (match.status === "scheduled") {
    return <UpcomingMatchCard key={match.id} match={match} homeTeam={home} awayTeam={away} competition={competition} />;
  }
  if (match.status === "finished") {
    return <ResultCard key={match.id} match={match} homeTeam={home} awayTeam={away} competition={competition} />;
  }
  return null;
}

function TimelineSection({
  title,
  description,
  groups,
  getTeam,
  competition,
  emptyTitle,
}: {
  title: string;
  description: string;
  groups: ReturnType<typeof groupMatchesByDate>;
  getTeam: (id: string) => Team;
  competition: Competition;
  emptyTitle: string;
}) {
  const totalMatches = groups.reduce((count, group) => count + group.matches.length, 0);

  return (
    <section aria-labelledby={title.replace(/\s+/g, "-").toLowerCase()} className="space-y-4">
      <header>
        <h2 id={title.replace(/\s+/g, "-").toLowerCase()} className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {totalMatches === 0 ? (
        <EmptyState title={emptyTitle} description="Los partidos aparecerán aquí cuando el proveedor los publique." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              {groups.length > 1 ? (
                <h3 className="font-display text-lg font-semibold capitalize">{group.label}</h3>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.matches.map((match) => renderMatchCard(match, getTeam, competition))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const WorldChampionshipPage = () => {
  useDocumentMeta({
    title: "Campeonato Mundial",
    description: "Partidos del World Championship: resultados, encuentros en curso y próximos partidos.",
  });

  const { bundle, isLoading, isError, refetch } = useWorldChampionshipData();
  const { matches, competitions, teams } = bundle;
  const getTeam = (id: string) => teams.find((team) => team.id === id)!;

  const competition = useMemo(
    () => competitions.find(isWorldChampionshipCompetition),
    [competitions],
  );

  const worldMatches = useMemo(
    () => filterWorldChampionshipMatches(matches, competitions),
    [matches, competitions],
  );

  const timeline = useMemo(
    () => splitWorldChampionshipTimeline(worldMatches),
    [worldMatches],
  );

  const presentGroups = useMemo(
    () => [{ key: "present", label: "Ahora", matches: timeline.present }],
    [timeline.present],
  );

  const pastGroups = useMemo(
    () => groupMatchesByDate(timeline.past, { order: "desc" }),
    [timeline.past],
  );

  const futureGroups = useMemo(
    () => groupMatchesByDate(timeline.future, { order: "asc" }),
    [timeline.future],
  );

  const fallbackCompetition: Competition = competition ?? {
    id: "world-championship",
    name: WORLD_CHAMPIONSHIP_NAME,
    region: "World",
    sport: "football",
    monogram: "WC",
    color: "10 70% 50%",
    activeMatches: timeline.present.filter((match) => isLiveMatchStatus(match.status)).length,
  };

  return (
    <section className="container mx-auto space-y-10 px-4 py-6 md:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-primary">Torneo internacional</p>
        <h1 className="font-display text-3xl font-bold">{WORLD_CHAMPIONSHIP_NAME}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sigue el torneo en tres bloques: partidos ya jugados, el encuentro actual y los próximos partidos programados.
        </p>
      </header>

      {isLoading ? (
        <SkeletonLoader className="h-72 w-full" />
      ) : isError ? (
        <ErrorState
          title="No se pudieron cargar los partidos del campeonato"
          description="Comprueba la conexión con el proveedor deportivo."
          action={<Button onClick={() => void refetch()}>Reintentar</Button>}
        />
      ) : worldMatches.length === 0 ? (
        <EmptyState
          title="Sin partidos del World Championship"
          description="El proveedor no devolvió encuentros de este torneo en la ventana consultada."
        />
      ) : (
        <div className="space-y-10">
          <TimelineSection
            title="Presente"
            description="Partidos en directo ahora, los de hoy o el próximo encuentro si no hay ninguno programado para hoy."
            groups={presentGroups}
            getTeam={getTeam}
            competition={fallbackCompetition}
            emptyTitle="No hay partido actual"
          />
          <TimelineSection
            title="Futuro"
            description="Próximos partidos del torneo, ordenados cronológicamente."
            groups={futureGroups}
            getTeam={getTeam}
            competition={fallbackCompetition}
            emptyTitle="No hay partidos futuros"
          />
          <TimelineSection
            title="Pasado"
            description="Partidos finalizados, empezando por los más recientes."
            groups={pastGroups}
            getTeam={getTeam}
            competition={fallbackCompetition}
            emptyTitle="Aún no hay resultados"
          />
        </div>
      )}
    </section>
  );
};

export default WorldChampionshipPage;
