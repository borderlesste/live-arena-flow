import { LegalLayout } from "./LegalLayout";

const CommunityRulesPage = () => (
  <LegalLayout title="Normas de la comunidad" description="Reglas para mantener un chat respetuoso y seguro.">
    <ul>
      <li>Respeta a otros usuarios y a los equipos.</li>
      <li>Prohibido el lenguaje discriminatorio, violento o de odio.</li>
      <li>No spam, no publicidad no autorizada, no enlaces externos sospechosos.</li>
      <li>No compartas información personal de terceros.</li>
      <li>Modo lento activo: ayuda a mantener una conversación legible.</li>
    </ul>
    <p>El incumplimiento puede derivar en muteo o expulsión. La moderación real requiere infraestructura de backend (no incluida en esta demo).</p>
  </LegalLayout>
);
export default CommunityRulesPage;
