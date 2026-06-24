import { LegalLayout } from "./LegalLayout";
import { SponsorLogo } from "@/components/sponsors/SponsorCarousel";
import { useContentData } from "@/hooks/useContentData";

const SponsorsInfoPage = () => {
  const { sponsors } = useContentData();
  return (
    <LegalLayout title="Patrocinadores" description="Marcas que apoyan a Luis Romero Fútbol.">
      <p>Estos son los patrocinadores oficiales que hacen posible la plataforma.</p>
      {sponsors.length === 0 ? <p>No hay patrocinadores publicados actualmente.</p> : (
        <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => <SponsorLogo key={sponsor.id} sponsor={sponsor} />)}
        </div>
      )}
      <p className="mt-6">¿Quieres patrocinar un evento? Escríbenos desde la página de <a href="/contact">contacto</a>.</p>
    </LegalLayout>
  );
};

export default SponsorsInfoPage;
