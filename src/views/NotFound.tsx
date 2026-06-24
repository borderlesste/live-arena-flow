import { Link, useLocation } from "react-router-dom";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Button } from "@/components/ui/button";
import { Home, Radio } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

const NotFound = () => {
  const loc = useLocation();
  useDocumentMeta({ title: "Página no encontrada", description: "La página que buscas no existe." });
  return (
    <section className="container mx-auto grid min-h-[60vh] place-items-center px-4 py-16 text-center">
      <div className="space-y-4">
        <BrandLogo variant="white" size="xl" withWordmark={false} className="mx-auto opacity-90" />
        <p className="font-display text-6xl font-bold text-gradient">404</p>
        <h1 className="font-display text-2xl font-semibold">No encontramos esa página</h1>
        <p className="text-sm text-muted-foreground">La ruta <code className="rounded bg-surface-2 px-1 py-0.5">{loc.pathname}</code> no existe en Luis Romero Fútbol.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild><Link to="/"><Home className="mr-1.5 h-4 w-4" /> Volver al inicio</Link></Button>
          <Button asChild variant="outline"><Link to="/live"><Radio className="mr-1.5 h-4 w-4" /> Ver en vivo</Link></Button>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
