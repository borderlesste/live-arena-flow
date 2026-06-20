import { LegalLayout } from "./LegalLayout";
import { sponsors } from "@/data/mocks";
import { SponsorLogo } from "@/components/sponsors/SponsorCarousel";

const SponsorsInfoPage = () => (
  <LegalLayout title="Patrocinadores" description="Marcas que apoyan a Arena Live Sports.">
    <p>Estos son los patrocinadores oficiales (ficticios) que hacen posible la plataforma.</p>
    <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sponsors.map((s) => <SponsorLogo key={s.id} sponsor={s} />)}
    </div>
    <p className="mt-6">¿Quieres patrocinar un evento? Escríbenos a <a href="/contact">contacto</a>.</p>
  </LegalLayout>
);
export default SponsorsInfoPage;
