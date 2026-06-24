import { useEffect, useState, type FormEvent } from "react";
import { Bell, CalendarDays, CheckCircle2, KeyRound, LogIn, LogOut, Mail, ShieldCheck, Trash2, User, UserPlus } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useFavoriteMatchEvents } from "@/hooks/useFavoriteMatch";
import { formatMatchDate } from "@/lib/format";

const ProfilePage = () => {
  useDocumentMeta({ title: "Perfil", description: "Gestiona tu cuenta y preferencias de Luis Romero Fútbol." });
  const auth = useAuth();
  const followedMatches = useFavoriteMatchEvents();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferences, setPreferences] = useState({ matchReminders: false });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.profile) return;
    const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    setNotificationPermission(permission);
    setDisplayName(auth.profile.displayName);
    setPreferences({ matchReminders: auth.profile.preferences.matchReminders && permission === "granted" });
  }, [auth.profile]);

  async function toggleMatchReminders(checked: boolean) {
    if (!checked) { setPreferences({ matchReminders: false }); return; }
    if (typeof Notification === "undefined") {
      toast.error("Este navegador no admite notificaciones");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setPreferences({ matchReminders: false });
      toast.error("Debes permitir las notificaciones en el navegador");
      return;
    }
    setPreferences({ matchReminders: true });
    toast.success("Notificaciones del navegador activadas");
  }

  async function submitAccess(event: FormEvent<HTMLFormElement>, mode: "login" | "register") {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") await auth.register(displayName, email, password);
      else await auth.login(email, password);
      setPassword("");
      toast.success(mode === "register" ? "Cuenta creada" : "Sesión iniciada");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar el acceso");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (preferences.matchReminders && (typeof Notification === "undefined" || Notification.permission !== "granted")) throw new Error("Autoriza las notificaciones del navegador antes de guardar");
      await auth.save(displayName, preferences);
      toast.success("Perfil actualizado");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo actualizar el perfil");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await auth.logout();
    setEmail("");
    setPassword("");
    toast.success("Sesión cerrada");
  }

  async function googleLogin() {
    setSubmitting(true);
    setError(null);
    try { await auth.loginWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión con Google"); setSubmitting(false); }
  }

  async function recoverPassword() {
    if (!email) { setError("Escribe tu correo para recuperar la contraseña"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await auth.requestPasswordReset(email);
      toast.success("Revisa tu correo para restablecer la contraseña");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el correo");
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.isLoading) {
    return <section className="container mx-auto space-y-4 px-4 py-8 md:px-6"><SkeletonLoader className="h-40 w-full" /><SkeletonLoader className="h-80 w-full" /></section>;
  }

  if (!auth.authenticated || !auth.profile) {
    return (
      <section className="container mx-auto grid gap-6 px-4 py-8 md:px-6 lg:grid-cols-[1fr_440px] lg:py-12">
        <div className="surface-card flex min-h-[460px] flex-col justify-between overflow-hidden rounded-xl bg-gradient-hero p-6 md:p-10">
          <div>
            <div className="mb-8 w-fit rounded-xl bg-white p-3 shadow-elegant"><BrandLogo variant="primary" size="lg" priority /></div>
            <p className="text-xs uppercase tracking-wider text-primary">Tu espacio Luis Romero Fútbol</p>
            <h1 className="mt-2 max-w-xl font-display text-3xl font-bold md:text-5xl">Sigue cada partido a tu manera.</h1>
            <p className="mt-4 max-w-lg text-muted-foreground">Crea una cuenta para gestionar alertas y personalizar cómo recibes las novedades deportivas.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Benefit icon={Bell} title="Alertas reales" description="Avisos del navegador antes del inicio." />
            <Benefit icon={CalendarDays} title="Tus partidos" description="Consulta en el perfil los eventos que sigues." />
            <Benefit icon={ShieldCheck} title="Sesión segura" description="Contraseña protegida con scrypt." />
          </div>
        </div>

        <Card className="surface-card self-center">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Accede a tu perfil</CardTitle>
            <CardDescription>Tu sesión se conserva de forma segura en este dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" onValueChange={() => setError(null)}>
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">Iniciar sesión</TabsTrigger><TabsTrigger value="register">Crear cuenta</TabsTrigger></TabsList>
              <TabsContent value="login"><AuthForm mode="login" email={email} password={password} displayName={displayName} submitting={submitting} error={error} onEmail={setEmail} onPassword={setPassword} onDisplayName={setDisplayName} onSubmit={submitAccess} /></TabsContent>
              <TabsContent value="register"><AuthForm mode="register" email={email} password={password} displayName={displayName} submitting={submitting} error={error} onEmail={setEmail} onPassword={setPassword} onDisplayName={setDisplayName} onSubmit={submitAccess} /></TabsContent>
            </Tabs>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o continúa con<span className="h-px flex-1 bg-border" /></div>
            <Button type="button" variant="outline" className="w-full" disabled={submitting} onClick={() => void googleLogin()}>Google</Button>
            <Button type="button" variant="link" className="mt-2 w-full" disabled={submitting} onClick={() => void recoverPassword()}><KeyRound className="mr-2 h-4 w-4" />Recuperar contraseña</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const initials = auth.profile.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <section className="container mx-auto space-y-6 px-4 py-8 md:px-6">
      <div className="surface-card flex flex-col gap-5 rounded-xl bg-gradient-hero p-6 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 ring-2 ring-primary/40"><AvatarFallback className="bg-primary/15 font-display text-xl font-bold text-primary">{initials}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="truncate font-display text-3xl font-bold">{auth.profile.displayName}</h1><Badge className="bg-success/15 text-success hover:bg-success/20"><CheckCircle2 className="mr-1 h-3 w-3" />Cuenta activa</Badge><Badge variant="outline">{auth.profile.role}</Badge></div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{auth.profile.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Miembro desde {new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(new Date(auth.profile.createdAt))}</p>
        </div>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="font-display">Partidos que sigo</CardTitle>
          <CardDescription>Tus partidos guardados se conservan en tu cuenta y están disponibles en cualquier sesión.</CardDescription>
        </CardHeader>
        <CardContent>
          {followedMatches.isLoading ? <SkeletonLoader className="h-28 w-full" /> : followedMatches.isError ? (
            <ErrorState title="No pudimos cargar tus partidos" description="Intenta actualizar la página." />
          ) : followedMatches.favorites.length === 0 ? (
            <EmptyState title="Todavía no sigues partidos" description="Pulsa Seguir en cualquier tarjeta para guardarla aquí." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(followedMatches.data ?? []).map(({ id, event }) => (
                <div key={id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-surface-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{event?.competition.name ?? "Partido guardado"}</p>
                    <p className="truncate font-display font-semibold">{event ? `${event.homeTeam.name} vs ${event.awayTeam.name}` : id}</p>
                    {event ? <p className="mt-1 text-xs text-muted-foreground">{formatMatchDate(event.startsAt)}{event.venue ? ` · ${event.venue}` : ""}</p> : <p className="mt-1 text-xs text-warning">Los datos deportivos no están disponibles temporalmente.</p>}
                  </div>
                  {event ? <Button asChild size="sm" variant="ghost"><Link to={`/match/${id}`}>Ver</Link></Button> : null}
                  <Button size="icon" variant="ghost" aria-label="Dejar de seguir partido" onClick={() => void followedMatches.setFavorite(id, false).catch((cause) => toast.error(cause instanceof Error ? cause.message : "No se pudo eliminar"))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={saveProfile} className="space-y-6">
          <Card className="surface-card">
            <CardHeader><CardTitle className="font-display">Información personal</CardTitle><CardDescription>Datos visibles en tu cuenta y en el chat.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre visible"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></Field>
              <Field label="Correo electrónico"><Input value={auth.profile.email} type="email" disabled /></Field>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader><CardTitle className="font-display">Notificaciones</CardTitle><CardDescription>Configura avisos que Luis Romero Fútbol puede entregar realmente.</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              <Preference
                label="Recordatorios de partidos"
                description={notificationPermission === "granted" ? "Avisos del navegador 10 minutos antes para partidos que sigues, mientras Luis Romero Fútbol esté abierto." : notificationPermission === "denied" ? "Las notificaciones están bloqueadas en este navegador." : notificationPermission === "unsupported" ? "Este navegador no admite notificaciones." : "Al activarlo, el navegador solicitará permiso para mostrar avisos."}
                checked={preferences.matchReminders && notificationPermission === "granted"}
                disabled={notificationPermission === "unsupported"}
                onChange={(checked) => void toggleMatchReminders(checked)}
              />
            </CardContent>
          </Card>
          <Button type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar cambios"}</Button>
        </form>

        <Card className="surface-card h-fit">
          <CardHeader><CardTitle className="font-display text-lg">Cuenta</CardTitle><CardDescription>Seguridad y sesión actual.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-3 text-sm"><p className="font-medium">Sesión protegida</p><p className="mt-1 text-xs text-muted-foreground">El token caduca automáticamente después de 30 días.</p></div>
            <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Cerrar sesión</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

interface AuthFormProps {
  mode: "login" | "register";
  email: string;
  password: string;
  displayName: string;
  submitting: boolean;
  error: string | null;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onDisplayName: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, mode: "login" | "register") => void;
}

function AuthForm({ mode, email, password, displayName, submitting, error, onEmail, onPassword, onDisplayName, onSubmit }: AuthFormProps) {
  return (
    <form onSubmit={(event) => onSubmit(event, mode)} className="mt-5 space-y-4">
      {mode === "register" ? <Field label="Nombre visible"><Input value={displayName} onChange={(event) => onDisplayName(event.target.value)} autoComplete="name" minLength={2} maxLength={40} required /></Field> : null}
      <Field label="Correo electrónico"><Input value={email} onChange={(event) => onEmail(event.target.value)} type="email" autoComplete="email" required /></Field>
      <Field label="Contraseña"><Input value={password} onChange={(event) => onPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required /><p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p></Field>
      {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting} className="w-full">{mode === "login" ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}{submitting ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Preference({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0"><div><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} /></div>;
}

function Benefit({ icon: Icon, title, description }: { icon: typeof User; title: string; description: string }) {
  return <div className="rounded-lg border border-border/70 bg-surface/50 p-3"><Icon className="h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

export default ProfilePage;
