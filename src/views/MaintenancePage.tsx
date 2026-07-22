import { Link } from "react-router-dom";
import { ShieldCheck, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const MaintenancePage = () => {
  useDocumentMeta({ title: "Mantenimiento", description: "Luis Romero Fútbol volverá a estar disponible pronto." });
  return (
    <section className="container mx-auto grid min-h-[65vh] place-items-center px-4 py-16 text-center">
      <div className="surface-card max-w-xl rounded-xl p-8 md:p-12">
        <BrandLogo variant="white" size="xl" priority className="mx-auto" />
        <Wrench className="mx-auto mt-8 h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl font-bold">Estamos afinando la cancha</h1>
        <p className="mt-3 text-muted-foreground">Luis Romero Fútbol está en mantenimiento. Volveremos pronto con transmisiones, partidos y resultados.</p>
        <Button asChild className="mt-6">
          <Link to="/profile"><ShieldCheck className="mr-2 h-4 w-4" />Entrar como administrador</Link>
        </Button>
      </div>
    </section>
  );
};

export default MaintenancePage;
