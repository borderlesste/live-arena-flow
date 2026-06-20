import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ResultCard } from "@/components/matches/ResultCard";
import { getFinishedMatches } from "@/services/matches.service";
import { competitions, getTeam } from "@/data/mocks";
import { EmptyState } from "@/components/feedback/States";

const ResultsPage = () => {
  useDocumentMeta({ title: "Resultados", description: "Consulta los marcadores finales y resúmenes de los partidos." });
  const finished = getFinishedMatches();

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Resultados</h1>
        <p className="text-sm text-muted-foreground">Marcadores finales, resúmenes y repeticiones.</p>
      </header>
      {finished.length === 0 ? (
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
