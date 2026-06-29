import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CompetitionCard } from "@/components/competitions/CompetitionCard";
import { useSportsWindow } from "@/hooks/useSportsData";
import { EmptyState } from "@/components/feedback/States";

const CompetitionsPage = () => {
  useDocumentMeta({ title: "Competiciones", description: "Sigue tus competiciones favoritas y consulta posiciones." });
  const { bundle } = useSportsWindow();
  const competitions = bundle.competitions;
  return (
    <section className="container mx-auto space-y-8 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Competiciones</h1>
        <p className="text-sm text-muted-foreground">Sigue ligas, copas y torneos en un solo lugar.</p>
      </header>
      {competitions.length === 0 ? <EmptyState title="Sin competiciones disponibles" description="SportSRC no devolvió competiciones para las fechas consultadas." /> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {competitions.map((c) => <CompetitionCard key={c.id} competition={c} />)}
      </div>}
    </section>
  );
};

export default CompetitionsPage;
