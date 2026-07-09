import { useCallback, useEffect, useState, type DragEvent, type ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Copy, GripVertical, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { sponsorAdminSchema, type ManagedSponsor } from "@/schemas/sponsor.schema";
import { getSessionToken } from "@/services/auth.service";
import { deleteManagedSponsor, listManagedSponsors, listSponsorMetrics, saveManagedSponsor, type SponsorMetrics } from "@/services/sponsors.service";
import { imageFileToDataUrl } from "@/lib/image-file";

const devices: ManagedSponsor["devices"] = ["mobile", "tablet", "desktop", "tv"];

function emptySponsor(priority = 0): ManagedSponsor {
  return {
    id: crypto.randomUUID(), name: "", image: undefined, logoUrl: undefined, altText: "", type: "partner", status: "draft",
    priority, devices: [...devices], position: "homepage", utm: {},
  };
}

function toLocalDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function parseUtm(value: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(value.replace(/^\?/, "")).entries());
}

function formatUtm(value: Record<string, string>): string {
  return new URLSearchParams(value).toString();
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export default function AdminSponsorsPage() {
  useDocumentMeta({ title: "Patrocinadores", description: "Gestiona campañas, ubicaciones y métricas de patrocinadores." });
  const auth = useAuth();
  const token = getSessionToken() ?? "";
  const canAdmin = auth.profile?.role === "super_admin" || auth.profile?.role === "admin";
  const [sponsors, setSponsors] = useState<ManagedSponsor[]>([]);
  const [metrics, setMetrics] = useState<Record<string, SponsorMetrics>>({});
  const [form, setForm] = useState<ManagedSponsor>(() => emptySponsor());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !canAdmin) { setLoading(false); return; }
    try {
      const [nextSponsors, nextMetrics] = await Promise.all([listManagedSponsors(token), listSponsorMetrics()]);
      setSponsors(nextSponsors);
      setMetrics(nextMetrics);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los patrocinadores");
    } finally {
      setLoading(false);
    }
  }, [token, canAdmin]);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof ManagedSponsor>(key: K, value: ManagedSponsor[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(emptySponsor(Math.max(0, ...sponsors.map((sponsor) => sponsor.priority)) + 1));
  }

  async function loadImage(file?: File) {
    if (!file) return;
    try {
      update("image", await imageFileToDataUrl(file));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo cargar la imagen");
    }
  }

  async function save(candidate = form) {
    const parsed = sponsorAdminSchema.safeParse(candidate);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Patrocinador inválido");
    try {
      const updated = await saveManagedSponsor(parsed.data, token);
      setSponsors(updated);
      toast.success(sponsors.some((item) => item.id === candidate.id) ? "Patrocinador actualizado" : "Patrocinador creado");
      reset();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo guardar");
    }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      setSponsors(await deleteManagedSponsor(deleteId, token));
      setDeleteId(null);
      toast.success("Patrocinador eliminado");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo eliminar");
    }
  }

  async function changeStatus(sponsor: ManagedSponsor, status: ManagedSponsor["status"]) {
    await save({ ...sponsor, status });
  }

  async function duplicate(sponsor: ManagedSponsor) {
    await save({ ...sponsor, id: crypto.randomUUID(), name: `${sponsor.name} (copia)`, status: "draft", priority: sponsor.priority + 1 });
  }

  async function drop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const reordered = [...sponsors];
    const sourceIndex = reordered.findIndex((item) => item.id === draggedId);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const prioritized = reordered.map((item, index) => ({ ...item, priority: reordered.length - index }));
    setSponsors(prioritized);
    setDraggedId(null);
    try {
      await Promise.all(prioritized.map((item) => saveManagedSponsor(item, token)));
      toast.success("Orden actualizado");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo reordenar");
      void load();
    }
  }

  if (auth.isLoading || loading) return <section className="container mx-auto space-y-4 px-4 py-8"><SkeletonLoader className="h-28 w-full" /><SkeletonLoader className="h-96 w-full" /></section>;
  if (!auth.authenticated) return <section className="container mx-auto px-4 py-12"><ErrorState title="Inicia sesión" description="Debes autenticarte para gestionar patrocinadores." /></section>;
  if (!canAdmin) return <section className="container mx-auto px-4 py-12"><ErrorState title="Acceso restringido" description="Tu cuenta no tiene permisos administrativos." /></section>;

  return (
    <section className="space-y-6">
      <header><p className="text-xs uppercase tracking-wider text-primary">Administración</p><h1 className="font-display text-3xl font-bold">Patrocinadores</h1><p className="text-sm text-muted-foreground">Publica, programa, ordena y mide campañas sin desplegar código.</p></header>
      {error ? <Alert variant="destructive"><AlertTitle>No se pudo cargar el panel</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <Card className="surface-card h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{sponsors.some((item) => item.id === form.id) ? "Editar patrocinador" : "Nuevo patrocinador"}</CardTitle><CardDescription>Los cambios activos se reflejan en el slider público.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nombre"><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Imagen guardada en la base de datos">
              <div className="space-y-2">
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void loadImage(event.target.files?.[0])} />
                <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Máximo 512 KB.</p>
                {form.image ? (
                  <div className="flex items-center gap-3">
                    <Image src={form.image} alt="Vista previa" width={112} height={64} unoptimized className="h-16 w-28 rounded-md bg-white/5 object-contain" />
                    <Button type="button" size="sm" variant="outline" onClick={() => update("image", undefined)}>Quitar</Button>
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Logo HTTPS alternativo"><Input type="url" value={form.logoUrl ?? ""} onChange={(event) => update("logoUrl", optionalText(event.target.value))} placeholder="https://cdn.example.com/logo.svg" /></Field>
            <Field label="Logo para fondo oscuro"><Input type="url" value={form.darkLogoUrl ?? ""} onChange={(event) => update("darkLogoUrl", event.target.value || undefined)} /></Field>
            <Field label="Texto alternativo"><Input value={form.altText} onChange={(event) => update("altText", event.target.value)} /></Field>
            <Field label="URL de destino"><Input type="url" value={form.destinationUrl ?? ""} onChange={(event) => update("destinationUrl", event.target.value || undefined)} /></Field>
            <Field label="Descripción"><Textarea value={form.description ?? ""} onChange={(event) => update("description", event.target.value || undefined)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo"><Select value={form.type} onValueChange={(value) => update("type", value as ManagedSponsor["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="main">Principal</SelectItem><SelectItem value="official">Oficial</SelectItem><SelectItem value="partner">Partner</SelectItem></SelectContent></Select></Field>
              <Field label="Estado"><Select value={form.status} onValueChange={(value) => update("status", value as ManagedSponsor["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Borrador</SelectItem><SelectItem value="scheduled">Programado</SelectItem><SelectItem value="active">Activo</SelectItem><SelectItem value="paused">Pausado</SelectItem><SelectItem value="ended">Finalizado</SelectItem></SelectContent></Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3"><Field label="Inicio"><Input type="datetime-local" value={toLocalDateTime(form.startsAt)} onChange={(event) => update("startsAt", fromLocalDateTime(event.target.value))} /></Field><Field label="Fin"><Input type="datetime-local" value={toLocalDateTime(form.endsAt)} onChange={(event) => update("endsAt", fromLocalDateTime(event.target.value))} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Prioridad"><Input type="number" min="0" value={form.priority} onChange={(event) => update("priority", Number(event.target.value))} /></Field><Field label="Posición"><Input value={form.position} onChange={(event) => update("position", event.target.value)} /></Field></div>
            <Field label="Campaña"><Input value={form.campaign ?? ""} onChange={(event) => update("campaign", event.target.value || undefined)} /></Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Competicion ID"><Input value={form.competitionId ?? ""} onChange={(event) => update("competitionId", optionalText(event.target.value))} placeholder="UUID" /></Field>
              <Field label="Partido ID"><Input value={form.matchId ?? ""} onChange={(event) => update("matchId", optionalText(event.target.value))} placeholder="UUID" /></Field>
              <Field label="Stream ID"><Input value={form.streamId ?? ""} onChange={(event) => update("streamId", optionalText(event.target.value))} placeholder="UUID" /></Field>
            </div>
            <Field label="Dispositivos"><div className="flex flex-wrap gap-2">{devices.map((device) => <Button key={device} type="button" size="sm" variant={form.devices.includes(device) ? "default" : "outline"} onClick={() => update("devices", form.devices.includes(device) ? form.devices.filter((item) => item !== device) : [...form.devices, device])}>{device}</Button>)}</div></Field>
            <Field label="UTM"><Input value={formatUtm(form.utm)} onChange={(event) => update("utm", parseUtm(event.target.value))} placeholder="utm_source=arena&utm_campaign=final" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Máx. impresiones"><Input type="number" min="1" value={form.maxImpressions ?? ""} onChange={(event) => update("maxImpressions", event.target.value ? Number(event.target.value) : undefined)} /></Field><Field label="Máx. clics"><Input type="number" min="1" value={form.maxClicks ?? ""} onChange={(event) => update("maxClicks", event.target.value ? Number(event.target.value) : undefined)} /></Field></div>
            <div className="flex gap-2"><Button className="flex-1" onClick={() => void save()}>Guardar</Button><Button variant="ghost" onClick={reset}>Limpiar</Button></div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {sponsors.length === 0 ? <EmptyState icon={<ImageIcon className="h-8 w-8" />} title="No hay patrocinadores" description="Crea la primera campaña para alimentar el slider público." /> : sponsors.map((sponsor) => {
            const metric = metrics[sponsor.id] ?? { impressions: 0, clicks: 0, ctr: 0 };
            return <Card key={sponsor.id} draggable onDragStart={() => setDraggedId(sponsor.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void drop(event, sponsor.id)} className="surface-card cursor-grab">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <GripVertical className="hidden h-5 w-5 text-muted-foreground lg:block" aria-label="Arrastrar para reordenar" />
                {sponsor.image || sponsor.logoUrl ? (
                  <Image
                    src={sponsor.image ?? sponsor.logoUrl ?? ""}
                    alt={sponsor.altText ?? sponsor.name}
                    width={96}
                    height={56}
                    unoptimized
                    className="h-14 w-24 rounded-md bg-white/5 object-contain"
                  />
                ) : <div className="grid h-14 w-24 place-items-center rounded-md bg-white/5 text-xs text-muted-foreground">Sin imagen</div>}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><p className="font-semibold">{sponsor.name}</p><Badge>{sponsor.status}</Badge><Badge variant="outline">{sponsor.type}</Badge></div><p className="truncate text-xs text-muted-foreground">{sponsor.campaign ?? "Sin campaña"} · prioridad {sponsor.priority}</p><div className="mt-2 flex gap-3 text-xs text-muted-foreground"><span>{metric.impressions} impresiones</span><span>{metric.clicks} clics</span><span>{metric.ctr.toFixed(2)}% CTR</span></div></div>
                <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => void changeStatus(sponsor, sponsor.status === "active" ? "paused" : "active")}>{sponsor.status === "active" ? "Pausar" : "Activar"}</Button><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setForm(sponsor); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Duplicar" onClick={() => void duplicate(sponsor)}><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Eliminar" className="text-destructive" onClick={() => setDeleteId(sponsor.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>;
          })}
          <Alert><BarChart3 className="h-4 w-4" /><AlertTitle>Métricas verificables</AlertTitle><AlertDescription>Las impresiones solo se cuentan tras visibilidad real y un segundo de permanencia; los clics usan claves idempotentes.</AlertDescription></Alert>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar patrocinador</AlertDialogTitle><AlertDialogDescription>La campaña dejará de aparecer públicamente. Esta acción requiere confirmación.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => void remove()}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
