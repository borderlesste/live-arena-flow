import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Activity, BarChart3, CalendarDays, ClipboardList, MessageSquareWarning, Settings, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { BrandSettingsPanel } from "@/components/admin/BrandSettingsPanel";
import { WebAnalyticsPanel } from "@/components/admin/WebAnalyticsPanel";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useSportsWindow } from "@/hooks/useSportsData";
import { getSessionToken } from "@/services/auth.service";
import { listManagedSponsors } from "@/services/sponsors.service";
import { listManagedVideoSources, type ManagedVideoSource } from "@/services/video-sources.service";
import {
  getAdminMetricsOverview,
  getAdminWebAnalytics,
  listAdminAudit,
  listAdminChatReports,
  listAdminStreamMetrics,
  listAdminUsers,
  type AdminAuditLog,
  type AdminChatReport,
  type AdminMetricsOverview,
  type AdminStreamMetric,
  type AdminUserRow,
  type AdminWebAnalytics,
  type WebAnalyticsPeriod,
} from "@/services/admin.service";

type AdminSection = "dashboard" | "matches" | "users" | "chat" | "analytics" | "settings" | "audit";

const sectionMeta: Record<AdminSection, { title: string; description: string; icon: typeof Activity }> = {
  dashboard: { title: "Dashboard", description: "Estado operativo de transmisiones, usuarios, SportSRC y patrocinadores.", icon: Activity },
  matches: { title: "Partidos", description: "Eventos normalizados desde el backend deportivo y su cobertura de streams.", icon: CalendarDays },
  users: { title: "Usuarios", description: "Perfiles, roles y estado de cuentas leídos desde el backend administrativo.", icon: Users },
  chat: { title: "Chat", description: "Reportes de mensajes y señales de moderación.", icon: MessageSquareWarning },
  analytics: { title: "Analítica", description: "Actividad, audiencia y métricas agregadas de streams.", icon: BarChart3 },
  settings: { title: "Configuración", description: "Identidad visual y parámetros globales gestionables.", icon: Settings },
  audit: { title: "Auditoría", description: "Registro de acciones sensibles y resultados.", icon: ClipboardList },
};

function sectionFromPath(pathname: string): AdminSection {
  const section = pathname.split("/").filter(Boolean).at(1);
  if (section === "matches" || section === "users" || section === "chat" || section === "analytics" || section === "settings" || section === "audit") return section;
  return "dashboard";
}

function dateRange(days = 7) {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatDate(value?: string | null) {
  if (!value) return "Sin dato";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function numberValue(value: number | undefined | null) {
  return new Intl.NumberFormat("es").format(value ?? 0);
}

export default function AdminOperationsPage() {
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const meta = sectionMeta[section];
  const Icon = meta.icon;
  useDocumentMeta({ title: `Admin - ${meta.title}`, description: meta.description });

  const auth = useAuth();
  const token = getSessionToken() ?? "";
  const canAdmin = auth.profile?.role === "super_admin" || auth.profile?.role === "admin";
  const { bundle, isLoading: sportsLoading, isError: sportsError, refetch } = useSportsWindow();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [reports, setReports] = useState<AdminChatReport[]>([]);
  const [audit, setAudit] = useState<AdminAuditLog[]>([]);
  const [metrics, setMetrics] = useState<AdminMetricsOverview>({});
  const [streamMetrics, setStreamMetrics] = useState<AdminStreamMetric[]>([]);
  const [sources, setSources] = useState<ManagedVideoSource[]>([]);
  const [sponsorCount, setSponsorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webAnalytics, setWebAnalytics] = useState<AdminWebAnalytics | null>(null);
  const [webAnalyticsPeriod, setWebAnalyticsPeriod] = useState<WebAnalyticsPeriod>("week");
  const [webAnalyticsLoading, setWebAnalyticsLoading] = useState(false);
  const [webAnalyticsError, setWebAnalyticsError] = useState<string | null>(null);

  const range = useMemo(() => dateRange(7), []);

  const load = useCallback(async () => {
    if (!token || !canAdmin) return;
    setLoading(true);
    try {
      const [nextMetrics, nextStreams, nextUsers, nextReports, nextAudit, nextSources, nextSponsors] = await Promise.all([
        getAdminMetricsOverview(token, range.start, range.end),
        listAdminStreamMetrics(token, range.start, range.end),
        listAdminUsers(token),
        listAdminChatReports(token),
        listAdminAudit(token),
        listManagedVideoSources(token),
        listManagedSponsors(token),
      ]);
      setMetrics(nextMetrics);
      setStreamMetrics(nextStreams);
      setUsers(nextUsers);
      setReports(nextReports);
      setAudit(nextAudit);
      setSources(nextSources);
      setSponsorCount(nextSponsors.length);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
    }
  }, [canAdmin, range.end, range.start, token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (section !== "analytics" || !token || !canAdmin) return;
    let cancelled = false;
    setWebAnalyticsLoading(true);
    void getAdminWebAnalytics(token, webAnalyticsPeriod)
      .then((result) => {
        if (cancelled) return;
        setWebAnalytics(result);
        setWebAnalyticsError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setWebAnalyticsError(cause instanceof Error ? cause.message : "No se pudo cargar la analítica web");
      })
      .finally(() => {
        if (!cancelled) setWebAnalyticsLoading(false);
      });
    return () => { cancelled = true; };
  }, [canAdmin, section, token, webAnalyticsPeriod]);

  if (auth.isLoading) return <AdminSkeleton />;
  if (!auth.authenticated) return <Guard title="Inicia sesión" description="Debes autenticarte para acceder al panel administrativo." />;
  if (!canAdmin) return <Guard title="Acceso restringido" description="Tu cuenta no tiene permisos administrativos." />;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Administración</p>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold"><Icon className="h-7 w-7 text-primary" />{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
      </header>
      {error ? <Alert variant="destructive"><AlertTitle>No se pudo cargar información</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <SkeletonLoader className="h-24 w-full" /> : null}

      {section === "dashboard" ? <Dashboard metrics={metrics} users={users} sources={sources} sponsorCount={sponsorCount} reports={reports} sportsProviderError={sportsError} /> : null}
      {section === "matches" ? <Matches bundle={bundle} sources={sources} loading={sportsLoading} error={sportsError} refresh={() => void refetch()} /> : null}
      {section === "users" ? <UsersTable users={users} /> : null}
      {section === "chat" ? <ChatReports reports={reports} /> : null}
      {section === "analytics" ? <Analytics metrics={metrics} streamMetrics={streamMetrics} webAnalytics={webAnalytics} webAnalyticsPeriod={webAnalyticsPeriod} webAnalyticsLoading={webAnalyticsLoading} webAnalyticsError={webAnalyticsError} onWebAnalyticsPeriodChange={setWebAnalyticsPeriod} /> : null}
      {section === "settings" ? <BrandSettingsPanel token={token} /> : null}
      {section === "audit" ? <AuditTable rows={audit} /> : null}
    </section>
  );
}

function AdminSkeleton() {
  return <section className="container mx-auto space-y-4 px-4 py-8"><SkeletonLoader className="h-28 w-full" /><SkeletonLoader className="h-96 w-full" /></section>;
}

function Guard({ title, description }: { title: string; description: string }) {
  return <section className="container mx-auto px-4 py-12 md:px-6"><ErrorState title={title} description={description} /></section>;
}

function Dashboard({ metrics, users, sources, sponsorCount, reports, sportsProviderError }: { metrics: AdminMetricsOverview; users: AdminUserRow[]; sources: ManagedVideoSource[]; sponsorCount: number; reports: AdminChatReport[]; sportsProviderError: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Usuarios registrados" value={users.length} />
        <MetricCard label="Fuentes activas" value={sources.length} />
        <MetricCard label="Patrocinadores gestionados" value={sponsorCount} />
        <MetricCard label="Reportes de chat" value={reports.length} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Eventos de actividad" value={metrics.total_activity_events} />
        <MetricCard label="Usuarios únicos 7 días" value={metrics.unique_active_ids} />
        <MetricCard label="Impresiones sponsor" value={metrics.total_sponsor_impressions} />
        <MetricCard label="Clics sponsor" value={metrics.total_sponsor_clicks} />
      </div>
      <Alert className={sportsProviderError ? "border-warning/40 bg-warning/5" : ""}>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Estado de datos deportivos</AlertTitle>
        <AlertDescription>{sportsProviderError ? "SportSRC no respondió correctamente. Revisa la licencia y la cuota de la cuenta." : "SportSRC respondió y el panel puede listar eventos."}</AlertDescription>
      </Alert>
    </div>
  );
}

function Matches({ bundle, sources, loading, error, refresh }: { bundle: ReturnType<typeof useSportsWindow>["bundle"]; sources: ManagedVideoSource[]; loading: boolean; error: boolean; refresh: () => void }) {
  if (loading) return <SkeletonLoader className="h-80 w-full" />;
  if (error) return <ErrorState title="No se pudieron cargar los partidos" description="Revisa las credenciales del proveedor deportivo o usa el fallback configurado." />;
  if (!bundle.matches.length) return <EmptyState title="No hay partidos en la ventana actual" description="El backend no devolvió eventos para ayer, hoy o mañana." />;
  return (
    <Card className="surface-card">
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Partidos recientes y próximos</CardTitle><CardDescription>Fuente: backend deportivo normalizado.</CardDescription></div><button className="text-sm font-medium text-primary hover:underline" onClick={refresh}>Actualizar</button></CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>Partido</TableHead><TableHead>Estado</TableHead><TableHead>Inicio</TableHead><TableHead>Streams</TableHead></TableRow></TableHeader><TableBody>{bundle.matches.map((match) => {
        const home = bundle.teams.find((team) => team.id === match.homeTeamId)?.name ?? "Local";
        const away = bundle.teams.find((team) => team.id === match.awayTeamId)?.name ?? "Visitante";
        return <TableRow key={match.id}><TableCell className="font-medium">{home} vs {away}</TableCell><TableCell><Badge variant="outline">{match.status}</Badge></TableCell><TableCell>{formatDate(match.startsAt)}</TableCell><TableCell>{sources.filter((source) => source.matchId === match.id).length}</TableCell></TableRow>;
      })}</TableBody></Table></CardContent>
    </Card>
  );
}

function UsersTable({ users }: { users: AdminUserRow[] }) {
  if (!users.length) return <EmptyState title="No hay usuarios visibles" description="Aún no hay perfiles o tu rol no tiene lectura administrativa." />;
  return <Card className="surface-card"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead>Proveedor</TableHead><TableHead>Creado</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell><p className="font-medium">{user.displayName}</p><p className="font-mono text-xs text-muted-foreground">{user.email || user.id}</p></TableCell><TableCell><Badge>{user.role}</Badge></TableCell><TableCell>{user.accountStatus}</TableCell><TableCell>{user.provider}</TableCell><TableCell>{formatDate(user.createdAt)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function ChatReports({ reports }: { reports: AdminChatReport[] }) {
  if (!reports.length) return <EmptyState title="Sin reportes pendientes" description="Los reportes de usuarios aparecerán aquí para moderación." />;
  return <Card className="surface-card"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Mensaje</TableHead><TableHead>Reportado por</TableHead><TableHead>Razón</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader><TableBody>{reports.map((report) => <TableRow key={report.id}><TableCell className="max-w-md truncate">{report.message?.body ?? "Mensaje eliminado"}</TableCell><TableCell>{report.reporterName}</TableCell><TableCell>{report.reason}</TableCell><TableCell>{formatDate(report.created_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function Analytics({ metrics, streamMetrics, webAnalytics, webAnalyticsPeriod, webAnalyticsLoading, webAnalyticsError, onWebAnalyticsPeriodChange }: {
  metrics: AdminMetricsOverview;
  streamMetrics: AdminStreamMetric[];
  webAnalytics: AdminWebAnalytics | null;
  webAnalyticsPeriod: WebAnalyticsPeriod;
  webAnalyticsLoading: boolean;
  webAnalyticsError: string | null;
  onWebAnalyticsPeriodChange: (period: WebAnalyticsPeriod) => void;
}) {
  return (
    <div className="space-y-6">
      <WebAnalyticsPanel data={webAnalytics} period={webAnalyticsPeriod} loading={webAnalyticsLoading} error={webAnalyticsError} onPeriodChange={onWebAnalyticsPeriodChange} />
      <div className="border-t border-border/70 pt-6">
        <h2 className="font-display text-xl font-semibold">Actividad de la plataforma</h2>
        <p className="text-sm text-muted-foreground">Eventos internos, patrocinadores y reproducción durante los últimos 7 días.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Actividad" value={metrics.total_activity_events} />
        <MetricCard label="Únicos" value={metrics.unique_active_ids} />
        <MetricCard label="Impresiones" value={metrics.total_sponsor_impressions} />
        <MetricCard label="Clics" value={metrics.total_sponsor_clicks} />
      </div>
      <Card className="surface-card"><CardHeader><CardTitle>Métricas por stream</CardTitle><CardDescription>Ventana: últimos 7 días.</CardDescription></CardHeader><CardContent>{streamMetrics.length ? <Table><TableHeader><TableRow><TableHead>Stream</TableHead><TableHead>Inicios</TableHead><TableHead>Usuarios únicos</TableHead><TableHead>Pico</TableHead><TableHead>Promedio</TableHead></TableRow></TableHeader><TableBody>{streamMetrics.map((metric) => <TableRow key={metric.streamId}><TableCell className="font-mono text-xs">{metric.streamId}</TableCell><TableCell>{numberValue(metric.view_starts)}</TableCell><TableCell>{numberValue(metric.unique_users)}</TableCell><TableCell>{numberValue(metric.peak_viewers)}</TableCell><TableCell>{numberValue(metric.avg_viewers)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="Sin eventos de reproducción" description="Las métricas aparecerán cuando el player registre actividad." />}</CardContent></Card>
    </div>
  );
}

function AuditTable({ rows }: { rows: AdminAuditLog[] }) {
  if (!rows.length) return <EmptyState title="Sin auditoría visible" description="Cuando se registren acciones sensibles aparecerán en esta vista." />;
  return <Card className="surface-card"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Acción</TableHead><TableHead>Entidad</TableHead><TableHead>Resultado</TableHead><TableHead>Actor</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.action}</TableCell><TableCell>{row.entity_type}</TableCell><TableCell><Badge variant={row.result === "success" ? "default" : "destructive"}>{row.result}</Badge></TableCell><TableCell className="font-mono text-xs">{row.actor_id ?? "sistema"}</TableCell><TableCell>{formatDate(row.created_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function MetricCard({ label, value }: { label: string; value: number | undefined | null }) {
  return <Card className="surface-card"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="font-display text-3xl">{numberValue(value)}</CardTitle></CardHeader></Card>;
}
