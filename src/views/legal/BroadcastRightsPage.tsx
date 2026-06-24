import { LegalLayout } from "./LegalLayout";

const BroadcastRightsPage = () => (
  <LegalLayout title="Derechos de transmisión" description="Cómo gestionamos los derechos de retransmisión deportiva.">
    <p>Luis Romero Fútbol sólo emite eventos cuando cuenta con los derechos correspondientes o cuando el creador autoriza la difusión a través de un proveedor licenciado.</p>
    <h2>Proveedores soportados</h2>
    <ul>
      <li>HLS (.m3u8) servido desde CDN propio o autorizado.</li>
      <li>Embeds oficiales de YouTube, TikTok y Vimeo cuando el origen lo permita.</li>
      <li>WebRTC mediante WHEP a través de un servidor de medios autorizado.</li>
    </ul>
    <p><strong>Importante:</strong> el navegador no reproduce RTMP. OBS u otros codificadores deben publicar contra un servidor de ingest (nginx-rtmp, MediaMTX, Cloudflare Stream, Mux, AWS IVS) que re-emita en HLS o WebRTC.</p>
  </LegalLayout>
);
export default BroadcastRightsPage;
