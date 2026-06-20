import { LegalLayout } from "./LegalLayout";
import { Mail, MessageCircle } from "lucide-react";

const ContactPage = () => (
  <LegalLayout title="Contacto" description="Habla con el equipo de Arena Live Sports.">
    <p>¿Quieres colaborar, retransmitir un evento o reportar un problema? Escríbenos:</p>
    <ul>
      <li><Mail className="mr-1 inline h-4 w-4" /> <a href="mailto:hola@arena.live">hola@arena.live</a></li>
      <li><MessageCircle className="mr-1 inline h-4 w-4" /> <a href="/community-rules">Normas de la comunidad</a></li>
    </ul>
    <p>El formulario de contacto requiere backend para procesar mensajes.</p>
  </LegalLayout>
);
export default ContactPage;
