import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, LoaderCircle } from "lucide-react";
import { AuthFlowCard } from "@/components/auth/AuthFlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { hasVerifiedRecoverySession, subscribeToAuth, updatePassword } from "@/services/auth.service";

export default function UpdatePasswordPage() {
  useDocumentMeta({ title: "Nueva contraseña", description: "Define una contraseña nueva para recuperar tu cuenta." });
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    function checkSession() {
      void hasVerifiedRecoverySession().then((valid) => {
        if (active) {
          setValidSession(valid);
          setChecking(false);
        }
      });
    }
    checkSession();
    const unsubscribe = subscribeToAuth((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") checkSession();
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast.success("Contraseña actualizada. Inicia sesión nuevamente.");
      navigate("/profile", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFlowCard title="Crea una contraseña nueva" description="El enlace solo puede utilizarse durante un tiempo limitado.">
      {checking ? <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Validando enlace…</p> : null}
      {!checking && !validSession ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">El enlace de recuperación no es válido o expiró. Solicita uno nuevo.</p> : null}
      {!checking && validSession ? <form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required autoFocus /><p className="text-xs text-muted-foreground">Usa al menos 8 caracteres.</p></div><div className="space-y-1.5"><Label htmlFor="confirm-password">Confirmar contraseña</Label><Input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></div>{error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</p> : null}<Button type="submit" className="w-full" disabled={submitting}><KeyRound className="mr-2 h-4 w-4" />{submitting ? "Actualizando…" : "Guardar contraseña"}</Button></form> : null}
    </AuthFlowCard>
  );
}
