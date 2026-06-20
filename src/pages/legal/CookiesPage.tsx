import { LegalLayout } from "./LegalLayout";

const CookiesPage = () => (
  <LegalLayout title="Política de cookies" description="Uso de cookies y tecnologías similares.">
    <p>Usamos cookies estrictamente necesarias para el funcionamiento del sitio y, opcionalmente, cookies de terceros (por ejemplo, proveedores de vídeo) sólo cuando aceptas explícitamente cargar su embed.</p>
    <h2>Tipos de cookies</h2>
    <ul><li><strong>Esenciales:</strong> sesión y preferencias.</li><li><strong>Terceros:</strong> proveedores de transmisión bajo consentimiento.</li></ul>
    <p>Puedes borrar cookies en cualquier momento desde tu navegador.</p>
  </LegalLayout>
);
export default CookiesPage;
