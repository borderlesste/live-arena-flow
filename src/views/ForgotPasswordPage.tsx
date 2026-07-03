import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { AuthFlowCard } from "@/components/auth/AuthFlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { requestPasswordReset } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  useDocumentMeta({ title: "Recuperar cuenta", description: "Solicita un enlace seguro para restablecer tu contraseña." });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFlowCard title="Recuperar cuenta" description="Te enviaremos un enlace de un solo uso para crear una contraseña nueva.">
      {sent ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-4 w-4" />Revisa tu correo</p>
          <p className="mt-2 text-muted-foreground">Si existe una cuenta con ese correo, recibirás las instrucciones en los próximos minutos.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-email">Correo electrónico</Label>
            <Input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={160} autoFocus />
          </div>
          {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}><Mail className="mr-2 h-4 w-4" />{submitting ? "Enviando…" : "Enviar enlace"}</Button>
        </form>
      )}
    </AuthFlowCard>
  );
}
