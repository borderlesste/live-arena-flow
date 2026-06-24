import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ResultCard } from "@/components/matches/ResultCard";
import { useSportsWindow } from "@/hooks/useSportsData";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { Button } from "@/components/ui/button";

const ResultsPage = () => {
  useDocumentMeta({ title: "Resultados", description: "Consulta los marcadores finales y resúmenes de los partidos." });
  const { bundle, isLoading, isError, refetch } = useSportsWindow();
  const finished = bundle.matches.filter((match) => match.status === "finished").sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const getTeam = (id: string) => bundle.teams.find((team) => team.id === id)!;
  const competitions = bundle.competitions;

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Resultados</h1>
        <p className="text-sm text-muted-foreground">Marcadores finales, resúmenes y repeticiones.</p>
      </header>
      {isLoading ? <SkeletonLoader className="h-72 w-full" /> : isError ? <ErrorState title="No se pudieron cargar los resultados" description="El proveedor deportivo no respondió correctamente." action={<Button onClick={() => void refetch()}>Reintentar</Button>} /> : finished.length === 0 ? (
        <EmptyState title="Aún no hay resultados" description="Vuelve más tarde para ver los marcadores finales." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {finished.map((m) => (
            <ResultCard key={m.id} match={m} homeTeam={getTeam(m.homeTeamId)} awayTeam={getTeam(m.awayTeamId)} competition={competitions.find((c) => c.id === m.competitionId)!} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ResultsPage;
