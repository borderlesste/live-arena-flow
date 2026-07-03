import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, MailCheck } from "lucide-react";
import { AuthFlowCard } from "@/components/auth/AuthFlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { resendSignupConfirmation } from "@/services/auth.service";

interface VerificationLocationState { email?: string }

export default function VerifyEmailPage() {
  useDocumentMeta({ title: "Verifica tu cuenta", description: "Confirma tu correo para activar tu cuenta." });
  const location = useLocation();
  const initialEmail = (location.state as VerificationLocationState | null)?.email ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resendSignupConfirmation(email.trim());
      setResent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo reenviar la verificación");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFlowCard title="Verifica tu correo" description="Tu cuenta fue creada, pero debes confirmar el correo antes de iniciar sesión.">
      <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-primary"><MailCheck className="h-4 w-4" />Enlace de verificación enviado</p>
        <p className="mt-2 text-muted-foreground">Abre el mensaje y pulsa el enlace. Revisa también spam o correo no deseado.</p>
      </div>
      <form onSubmit={resend} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="verification-email">Correo electrónico</Label>
          <Input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={160} />
        </div>
        {resent ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Correo reenviado.</p> : null}
        {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</p> : null}
        <Button type="submit" variant="outline" className="w-full" disabled={submitting}>{submitting ? "Reenviando…" : "Reenviar verificación"}</Button>
      </form>
    </AuthFlowCard>
  );
}
