import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CompetitionCard } from "@/components/competitions/CompetitionCard";
import { StandingsTable } from "@/components/competitions/StandingsTable";
import { competitions, standings } from "@/data/mocks";

const CompetitionsPage = () => {
  useDocumentMeta({ title: "Competiciones", description: "Sigue tus competiciones favoritas y consulta posiciones." });
  return (
    <section className="container mx-auto space-y-8 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Competiciones</h1>
        <p className="text-sm text-muted-foreground">Sigue ligas, copas y torneos en un solo lugar.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {competitions.map((c) => <CompetitionCard key={c.id} competition={c} />)}
      </div>
      <div>
        <h2 className="mb-4 font-display text-2xl font-bold">Tabla — Liga Continental</h2>
        <StandingsTable rows={standings["liga-continental"]} />
      </div>
    </section>
  );
};

export default CompetitionsPage;
