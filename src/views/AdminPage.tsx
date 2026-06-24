import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, RadioTower, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useLiveSportsWindow, useSportsDate, useSportsWindow } from "@/hooks/useSportsData";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { streamSourceSchema } from "@/schemas/stream.schema";
import {
  deleteManagedVideoSource,
  listManagedVideoSources,
  saveManagedVideoSource,
  type ManagedVideoSource,
} from "@/services/video-sources.service";
import type { StreamType } from "@/types";
import { getSessionToken } from "@/services/auth.service";
import { BrandSettingsPanel } from "@/components/admin/BrandSettingsPanel";
import type { SportsDataBundle } from "@/services/sports-data.mapper";

interface FormState {
  id?: string;
  matchId: string;
  title: string;
  purpose: "live" | "highlight";
  type: Extract<StreamType, "hls" | "obs_hls" | "mp4" | "mp3" | "youtube" | "youtube_live" | "embed" | "iframe">;
  playbackUrl: string;
  obsEnabled: boolean;
  obsProtocol: "rtmp" | "srt";
  obsServerUrl: string;
  obsStreamKey: string;
}

const emptyForm: FormState = {
  matchId: "",
  title: "Transmisión principal",
  purpose: "live",
  type: "hls",
  playbackUrl: "",
  obsEnabled: false,
  obsProtocol: "rtmp",
  obsServerUrl: "",
  obsStreamKey: "",
};

function youtubeEmbed(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    const id = url.searchParams.get("v");
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    return value;
  } catch {
    return value;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function mergeSportsBundles(...bundles: SportsDataBundle[]): SportsDataBundle {
  const matches = new Map<string, SportsDataBundle["matches"][number]>();
  const teams = new Map<string, SportsDataBundle["teams"][number]>();
  const competitions = new Map<string, SportsDataBundle["competitions"][number]>();
  for (const bundle of bundles) {
    bundle.matches.forEach((match) => matches.set(match.id, match));
    bundle.teams.forEach((team) => teams.set(team.id, team));
    bundle.competitions.forEach((competition) => competitions.set(competition.id, competition));
  }
  return {
    matches: [...matches.values()].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    teams: [...teams.values()],
    competitions: [...competitions.values()],
  };
}

const AdminPage = () => {
  useDocumentMeta({ title: "Administración", description: "Gestiona fuentes de vídeo y configuración OBS por partido." });
  const windowQuery = useSportsWindow();
  const liveQuery = useLiveSportsWindow();
  const [eventDate, setEventDate] = useState(todayKey);
  const dateQuery = useSportsDate(eventDate);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sources, setSources] = useState<ManagedVideoSource[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const bundle = useMemo(() => mergeSportsBundles(windowQuery.bundle, dateQuery.bundle, liveQuery.bundle), [dateQuery.bundle, liveQuery.bundle, windowQuery.bundle]);
  const isEventsLoading = (windowQuery.isLoading || dateQuery.isLoading || liveQuery.isLoading) && bundle.matches.length === 0;
  const isEventsError = windowQuery.isError && dateQuery.isError && liveQuery.isError;
  const teams = useMemo(() => new Map(bundle.teams.map((team) => [team.id, team])), [bundle.teams]);
  const token = getSessionToken() ?? "";
  const canAdmin = auth.profile?.role === "super_admin" || auth.profile?.role === "admin";

  const loadSources = useCallback(async () => {
    if (!token || !canAdmin) { setSources([]); return; }
    try {
      setSources(await listManagedVideoSources(token));
      setSourcesError(null);
    } catch (error) {
      setSourcesError(error instanceof Error ? error.message : "No se pudieron cargar las fuentes");
    }
  }, [token, canAdmin]);

  useEffect(() => { void loadSources(); }, [loadSources]);

  const eventLabel = (matchId: string) => {
    const match = bundle.matches.find((item) => item.id === matchId);
    if (!match) return `Evento ${matchId}`;
    return `${teams.get(match.homeTeamId)?.name ?? "Local"} vs ${teams.get(match.awayTeamId)?.name ?? "Visitante"}`;
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm({ ...emptyForm, matchId: bundle.matches[0]?.id ?? "" });
  }

  async function refreshEvents() {
    await Promise.all([windowQuery.refetch(), dateQuery.refetch(), liveQuery.refetch()]);
  }

  function edit(source: ManagedVideoSource) {
    setForm({
      id: source.id,
      matchId: source.matchId,
      title: source.title,
      purpose: source.purpose ?? "live",
      type: source.type,
      playbackUrl: source.url ?? source.embedUrl ?? "",
      obsEnabled: Boolean(source.obs),
      obsProtocol: source.obs?.protocol ?? "rtmp",
      obsServerUrl: source.obs?.serverUrl ?? "",
      obsStreamKey: source.obs?.streamKey ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    const matchId = form.matchId || bundle.matches[0]?.id;
    const embed = ["youtube", "youtube_live", "embed", "iframe"].includes(form.type);
    const source = {
      id: form.id ?? crypto.randomUUID(),
      type: form.type,
      title: form.title.trim(),
      isExternal: embed,
      purpose: form.purpose,
      provider: form.type === "youtube" || form.type === "youtube_live" ? "youtube" as const : "custom" as const,
      requiresConsent: embed,
      ...(embed ? { embedUrl: form.type === "youtube" || form.type === "youtube_live" ? youtubeEmbed(form.playbackUrl) : form.playbackUrl } : { url: form.playbackUrl }),
    };
    const parsed = streamSourceSchema.safeParse(source);
    if (!matchId) return toast.error("Selecciona un partido");
    if (!token || !canAdmin) return toast.error("Tu cuenta no tiene permisos administrativos");
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Fuente inválida");
    if (form.obsEnabled && !form.obsServerUrl.match(/^(rtmp|rtmps|srt):\/\//i)) {
      return toast.error("La dirección de ingestión debe comenzar por rtmp://, rtmps:// o srt://");
    }
    try {
      const updated = await saveManagedVideoSource({
        ...source,
        matchId,
        createdAt: new Date().toISOString(),
        purpose: form.purpose,
        obs: form.obsEnabled ? { protocol: form.obsProtocol, serverUrl: form.obsServerUrl, streamKey: form.obsStreamKey || undefined } : undefined,
      }, token);
      setSources(updated);
      await queryClient.invalidateQueries({ queryKey: ["sportsdb"] });
      toast.success(form.id ? "Fuente actualizada" : "Fuente creada");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la fuente");
    }
  }

  async function remove(id: string) {
    if (!token || !canAdmin) return toast.error("Tu cuenta no tiene permisos administrativos");
    try {
      setSources(await deleteManagedVideoSource(id, token));
      await queryClient.invalidateQueries({ queryKey: ["sportsdb"] });
      toast.success("Fuente eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la fuente");
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiada`);
  }

  if (auth.isLoading) {
    return <section className="container mx-auto space-y-4 px-4 py-8 md:px-6"><SkeletonLoader className="h-32 w-full" /><SkeletonLoader className="h-96 w-full" /></section>;
  }
  if (!auth.authenticated) {
    return <section className="container mx-auto px-4 py-12 md:px-6"><ErrorState title="Inicia sesión" description="Debes autenticarte para acceder al panel administrativo." /></section>;
  }
  if (!canAdmin) {
    return <section className="container mx-auto px-4 py-12 md:px-6"><ErrorState title="Acceso restringido" description="Tu cuenta no tiene un rol administrativo." /></section>;
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Control de emisión</p>
          <h1 className="font-display text-3xl font-bold">Fuentes de vídeo</h1>
          <p className="text-sm text-muted-foreground">Asocia transmisiones y highlights de strVideo con eventos de TheSportsDB.</p>
        </div>
        <Button variant="outline" onClick={() => void refreshEvents()}>Actualizar eventos</Button>
      </header>

      {sourcesError ? <Alert variant="destructive"><AlertTitle>No se pudo cargar el panel</AlertTitle><AlertDescription>{sourcesError}</AlertDescription></Alert> : null}

      <BrandSettingsPanel token={token} />

      <Alert className="border-warning/30 bg-warning/5">
        <RadioTower className="h-4 w-4" />
        <AlertTitle>OBS publica; el navegador reproduce</AlertTitle>
        <AlertDescription>Configura en OBS la dirección RTMP/SRT y su clave. Añade también la salida HTTPS HLS o MP4 entregada por MediaMTX, Mux o Cloudflare Stream. Las credenciales se guardan en backend y no se incluyen en la respuesta pública.</AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="surface-card h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display"><Plus className="h-5 w-5 text-primary" />{form.id ? "Editar fuente" : "Nueva fuente"}</CardTitle>
            <CardDescription>La fuente quedará disponible inmediatamente en el reproductor del partido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Field label="Fecha">
                <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value || todayKey())} />
              </Field>
              {isEventsLoading ? <div className="space-y-1.5"><Label>Partido</Label><SkeletonLoader className="h-10 w-full" /></div> : isEventsError ? <ErrorState title="No se pudieron cargar los eventos" description="Comprueba la conexion con la API deportiva." /> : (
                <Field label="Partido">
                  <Select value={form.matchId || bundle.matches[0]?.id} onValueChange={(value) => update("matchId", value)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un evento de la API" /></SelectTrigger>
                    <SelectContent>{bundle.matches.map((match) => <SelectItem key={match.id} value={match.id}>{eventLabel(match.id)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Nombre"><Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Señal principal HD" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Uso">
                <Select value={form.purpose} onValueChange={(value) => update("purpose", value as FormState["purpose"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">En vivo</SelectItem><SelectItem value="highlight">Highlight</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Formato">
                <Select value={form.type} onValueChange={(value) => update("type", value as FormState["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hls">HLS (.m3u8)</SelectItem><SelectItem value="obs_hls">OBS a HLS</SelectItem><SelectItem value="mp4">MP4</SelectItem><SelectItem value="mp3">MP3</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="youtube_live">YouTube Live</SelectItem><SelectItem value="embed">URL embed</SelectItem><SelectItem value="iframe">Iframe autorizado</SelectItem></SelectContent></Select>
              </Field>
            </div>
            <Field label="URL de reproducción"><Input type="url" value={form.playbackUrl} onChange={(event) => update("playbackUrl", event.target.value)} placeholder="https://cdn.example.com/live/index.m3u8" /></Field>

            <div className="rounded-lg border border-border bg-surface-2/40 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Publicar con OBS</p><p className="text-xs text-muted-foreground">Añade datos de ingestión para el operador.</p></div><Switch checked={form.obsEnabled} onCheckedChange={(value) => update("obsEnabled", value)} /></div>
              {form.obsEnabled ? <div className="mt-4 space-y-3">
                <Field label="Protocolo"><Select value={form.obsProtocol} onValueChange={(value) => update("obsProtocol", value as FormState["obsProtocol"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rtmp">RTMP</SelectItem><SelectItem value="srt">SRT</SelectItem></SelectContent></Select></Field>
                <Field label="Servidor de ingestión"><Input value={form.obsServerUrl} onChange={(event) => update("obsServerUrl", event.target.value)} placeholder="rtmp://ingest.example.com/live" /></Field>
                <Field label="Clave de transmisión"><Input type="password" value={form.obsStreamKey} onChange={(event) => update("obsStreamKey", event.target.value)} placeholder="••••••••••••" /></Field>
              </div> : null}
            </div>
            <div className="flex gap-2"><Button className="flex-1" onClick={save}>{form.id ? "Guardar cambios" : "Crear fuente"}</Button>{form.id ? <Button variant="ghost" onClick={reset}>Cancelar</Button> : null}</div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Fuentes configuradas</h2><Badge variant="secondary">{sources.length}</Badge></div>
          {sources.length === 0 ? <EmptyState title="Aún no hay fuentes" description="Crea una fuente y quedará asociada al evento seleccionado." /> : sources.map((source) => (
            <Card key={source.id} className="surface-card">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Video className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{source.title}</p><Badge variant="outline">{source.type.toUpperCase()}</Badge><Badge variant="secondary">{source.purpose === "highlight" ? "Highlight" : "En vivo"}</Badge>{source.obs ? <Badge className="bg-success/15 text-success hover:bg-success/20">OBS</Badge> : null}</div><p className="truncate text-sm text-muted-foreground">{eventLabel(source.matchId)}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{source.url ?? source.embedUrl}</p></div>
                {source.obs ? <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Copiar servidor OBS" onClick={() => copy(source.obs!.serverUrl, "Dirección OBS")}><Copy className="h-4 w-4" /></Button>{source.obs.streamKey ? <Button size="icon" variant="ghost" aria-label="Copiar clave OBS" onClick={() => copy(source.obs!.streamKey!, "Clave OBS")}><RadioTower className="h-4 w-4" /></Button> : null}</div> : null}
                <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Editar fuente" onClick={() => edit(source)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label="Eliminar fuente" onClick={() => remove(source.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export default AdminPage;
