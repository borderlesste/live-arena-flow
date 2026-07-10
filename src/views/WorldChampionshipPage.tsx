import { useMemo } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useWorldChampionshipData } from "@/hooks/useSportsData";
import { MatchCard } from "@/components/matches/MatchCard";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";
import { groupMatchesByDate } from "@/lib/format";
import { isLiveMatchStatus } from "@/lib/match-filters";
import {
  filterWorldChampionshipMatches,
  groupWorldChampionshipMatchesByPhase,
  isWorldChampionshipCompetition,
  WORLD_CHAMPIONSHIP_END_DATE,
  WORLD_CHAMPIONSHIP_NAME,
  WORLD_CHAMPIONSHIP_START_DATE,
} from "@/lib/world-championship";
import type { Competition, Team } from "@/types";

function PhaseSection({
  title,
  description,
  matches,
  teamById,
  competition,
}: {
  title: string;
  description: string;
  matches: ReturnType<typeof groupWorldChampionshipMatchesByPhase>[number]["matches"];
  teamById: Map<string, Team>;
  competition: Competition;
}) {
  const groups = groupMatchesByDate(matches, { order: "asc" });

  return (
    <section aria-labelledby={title.replace(/\s+/g, "-").toLowerCase()} className="space-y-4">
      <header>
        <h2 id={title.replace(/\s+/g, "-").toLowerCase()} className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.key} className="space-y-3">
            <h3 className="font-display text-lg font-semibold capitalize">{group.label}</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {group.matches.map((match) => {
                const homeTeam = teamById.get(match.homeTeamId);
                const awayTeam = teamById.get(match.awayTeamId);
                return homeTeam && awayTeam
                  ? <MatchCard key={match.id} match={match} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />
                  : null;
              })}
            </div>
          </div>
        ))}
      </div>
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
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const competition = useMemo(
    () => competitions.find(isWorldChampionshipCompetition),
    [competitions],
  );

  const worldMatches = useMemo(
    () => filterWorldChampionshipMatches(matches, competitions),
    [matches, competitions],
  );

  const phases = useMemo(
    () => groupWorldChampionshipMatchesByPhase(worldMatches),
    [worldMatches],
  );

  const fallbackCompetition: Competition = competition ?? {
    id: "world-championship",
    name: WORLD_CHAMPIONSHIP_NAME,
    region: "World",
    sport: "football",
    monogram: "WC",
    color: "10 70% 50%",
    activeMatches: worldMatches.filter((match) => isLiveMatchStatus(match.status)).length,
    totalMatches: worldMatches.length,
  };

  return (
    <section className="container mx-auto space-y-10 px-4 py-6 md:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-primary">Torneo internacional</p>
        <h1 className="font-display text-3xl font-bold">{WORLD_CHAMPIONSHIP_NAME}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Todos los partidos entre el 11 de junio y el 19 de julio de 2026, ordenados por fase y fecha.
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
          description={`El proveedor no devolvió encuentros entre ${WORLD_CHAMPIONSHIP_START_DATE} y ${WORLD_CHAMPIONSHIP_END_DATE}.`}
        />
      ) : (
        <div className="space-y-10">
          {phases.map((phase) => (
            <PhaseSection
              key={phase.key}
              title={phase.label}
              description={`${phase.matches.length} ${phase.matches.length === 1 ? "partido" : "partidos"} en esta fase.`}
              matches={phase.matches}
              teamById={teamById}
              competition={fallbackCompetition}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default WorldChampionshipPage;
