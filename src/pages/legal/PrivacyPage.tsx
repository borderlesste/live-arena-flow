import { LegalLayout } from "./LegalLayout";

const PrivacyPage = () => (
  <LegalLayout title="Privacidad" description="Cómo tratamos tus datos en Arena Live Sports.">
    <p>En Arena Live Sports respetamos tu privacidad. Esta página describe qué datos recopilamos, con qué finalidad y tus derechos.</p>
    <h2>Datos que recopilamos</h2>
    <ul><li>Datos técnicos del dispositivo y navegador.</li><li>Preferencias de visualización y favoritos.</li><li>Mensajes que envías al chat (cuando habilitemos cuentas).</li></ul>
    <h2>Finalidad</h2>
    <p>Mejorar la experiencia, prevenir abusos y ofrecer contenido relevante.</p>
    <h2>Derechos</h2>
    <p>Puedes solicitar acceso, rectificación o eliminación escribiendo a <a href="/contact">contacto</a>.</p>
  </LegalLayout>
);
export default PrivacyPage;
