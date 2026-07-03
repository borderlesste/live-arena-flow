import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { AuthFlowCard } from "@/components/auth/AuthFlowCard";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeToAuth } from "@/services/auth.service";

type ConfirmationState = "loading" | "verified" | "invalid";

export default function AuthConfirmationPage() {
  useDocumentMeta({ title: "Confirmar cuenta", description: "Procesando la verificación de tu correo." });
  const [state, setState] = useState<ConfirmationState>("loading");

  useEffect(() => {
    let active = true;
    async function verifySession() {
      const client = await getSupabaseClient();
      const { data, error } = await client.auth.getUser();
      if (!active) return;
      setState(!error && data.user?.email_confirmed_at ? "verified" : "invalid");
    }
    void verifySession();
    const unsubscribe = subscribeToAuth((event) => {
      if (event === "SIGNED_IN") void verifySession();
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  return (
    <AuthFlowCard title="Confirmación de cuenta" description="Estamos validando el enlace de tu correo.">
      {state === "loading" ? <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Verificando…</p> : null}
      {state === "verified" ? <div className="space-y-4"><p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success"><CheckCircle2 className="h-5 w-5" />Tu correo fue verificado correctamente.</p><Button asChild className="w-full"><Link to="/profile">Continuar a mi cuenta</Link></Button></div> : null}
      {state === "invalid" ? <div className="space-y-4"><p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />El enlace no es válido, expiró o ya fue utilizado.</p><Button asChild variant="outline" className="w-full"><Link to="/auth/verify-email">Solicitar otro enlace</Link></Button></div> : null}
    </AuthFlowCard>
  );
}
