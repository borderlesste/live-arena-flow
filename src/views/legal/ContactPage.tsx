import { useState, type FormEvent } from "react";
import { LegalLayout } from "./LegalLayout";
import { Mail, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const ContactPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Rellena los campos requeridos");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText || "Error al enviar");
      }
      toast.success("Mensaje enviado. Gracias.");
      setName(""); setEmail(""); setSubject(""); setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LegalLayout title="Contacto" description="Habla con el equipo de Luis Romero Fútbol.">
      <p>¿Quieres colaborar, retransmitir un evento o reportar un problema? Escríbenos:</p>
      <ul>
        <li><Mail className="mr-1 inline h-4 w-4" /> <a href="mailto:contacto@luisromerofutbol.com">contacto@luisromerofutbol.com</a></li>
        <li><MessageCircle className="mr-1 inline h-4 w-4" /> <Link to="/community-rules">Normas de la comunidad</Link></li>
      </ul>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Correo electrónico</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
        </div>

        <div>
          <Label>Asunto (opcional)</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div>
          <Label>Mensaje</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required />
        </div>

        <div>
          <Button type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar mensaje"}</Button>
        </div>
      </form>
    </LegalLayout>
  );
};

export default ContactPage;
