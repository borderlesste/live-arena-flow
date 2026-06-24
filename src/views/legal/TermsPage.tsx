import { LegalLayout } from "./LegalLayout";

const TermsPage = () => (
  <LegalLayout title="Términos de uso" description="Términos y condiciones de uso de Luis Romero Fútbol.">
    <p>Al usar Luis Romero Fútbol aceptas estos términos. La plataforma se ofrece "tal cual" y puede actualizarse en cualquier momento.</p>
    <h2>Uso aceptable</h2>
    <ul><li>No publiques contenido ilícito, ofensivo o spam.</li><li>No intentes evadir las restricciones técnicas.</li><li>Respeta los derechos de transmisión.</li></ul>
    <h2>Propiedad intelectual</h2>
    <p>Los datos de equipos, competiciones y partidos proceden de proveedores externos y pueden estar sujetos a sus propias condiciones.</p>
  </LegalLayout>
);
export default TermsPage;
