import { AlertTriangle, CalendarRange, Eye, MousePointerClick, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import type { AdminWebAnalytics, WebAnalyticsPeriod } from "@/services/admin.service";

const periodLabels: Record<WebAnalyticsPeriod, string> = {
  day: "Hoy",
  week: "7 días",
  month: "30 días",
  year: "12 meses",
};

const chartConfig = {
  visits: { label: "Visitas", color: "hsl(var(--primary))" },
  pageViews: { label: "Páginas vistas", color: "hsl(var(--chart-2, 142 70% 45%))" },
} satisfies ChartConfig;

function formatNumber(value: number) {
  return new Intl.NumberFormat("es").format(value);
}

function formatPointLabel(value: string, period: WebAnalyticsPeriod) {
  const date = new Date(period === "year" ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("es", period === "year" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

interface WebAnalyticsPanelProps {
  data: AdminWebAnalytics | null;
  period: WebAnalyticsPeriod;
  loading: boolean;
  error: string | null;
  onPeriodChange: (period: WebAnalyticsPeriod) => void;
}

export function WebAnalyticsPanel({ data, period, loading, error, onPeriodChange }: WebAnalyticsPanelProps) {
  const change = data?.changePercent ?? null;
  const changeLabel = change === null ? "Sin período anterior" : `${change > 0 ? "+" : ""}${change}% vs. período anterior`;
  const ChangeIcon = change !== null && change < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Visitas al sitio</h2>
          <p className="text-sm text-muted-foreground">Datos de Cloudflare Web Analytics conservados en el histórico de la plataforma.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-background/60 p-1" aria-label="Período de analítica">
          {(Object.keys(periodLabels) as WebAnalyticsPeriod[]).map((value) => (
            <Button key={value} type="button" size="sm" variant={period === value ? "default" : "ghost"} aria-pressed={period === value} onClick={() => onPeriodChange(value)}>
              {periodLabels[value]}
            </Button>
          ))}
        </div>
      </div>

      {error ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>No se pudo consultar la analítica</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {data?.syncStatus === "not_configured" ? <Alert><CalendarRange className="h-4 w-4" /><AlertTitle>Cloudflare Web Analytics pendiente de configuración</AlertTitle><AlertDescription>Configura el token público del beacon y un token privado con permiso Account Analytics: Read. Las métricas existentes del panel no se ven afectadas.</AlertDescription></Alert> : null}
      {data?.syncStatus === "error" ? <Alert className="border-warning/40 bg-warning/5"><AlertTriangle className="h-4 w-4" /><AlertTitle>Mostrando el último histórico disponible</AlertTitle><AlertDescription>Cloudflare no pudo sincronizarse en este momento. Los datos guardados permanecen disponibles.</AlertDescription></Alert> : null}

      {loading && !data ? <SkeletonLoader className="h-72 w-full" /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetric icon={UsersRound} label="Visitas" value={data?.totals.visits ?? 0} />
            <AnalyticsMetric icon={Eye} label="Páginas vistas" value={data?.totals.pageViews ?? 0} />
            <AnalyticsMetric icon={MousePointerClick} label="Páginas por visita" value={data?.totals.pagesPerVisit ?? 0} decimals />
            <Card className="surface-card"><CardHeader className="pb-2"><CardDescription>Cambio de visitas</CardDescription><CardTitle className="flex items-center gap-2 text-xl"><ChangeIcon className="h-5 w-5 text-primary" />{changeLabel}</CardTitle></CardHeader></Card>
          </div>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Tendencia de audiencia</CardTitle>
              <CardDescription>{data?.start ?? "—"} a {data?.end ?? "—"}{data?.lastSyncedAt ? ` · Actualizado ${new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.lastSyncedAt))}` : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.series.length ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
                  <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visits-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-visits)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--color-visits)" stopOpacity={0.02} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: string) => formatPointLabel(value, period)} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} width={42} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatPointLabel(String(value), period)} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area type="monotone" dataKey="pageViews" stroke="var(--color-pageViews)" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" dataKey="visits" stroke="var(--color-visits)" fill="url(#visits-fill)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              ) : <div className="flex min-h-56 items-center justify-center text-center text-sm text-muted-foreground">Aún no hay visitas registradas para este período.</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AnalyticsMetric({ icon: Icon, label, value, decimals = false }: { icon: typeof Eye; label: string; value: number; decimals?: boolean }) {
  return <Card className="surface-card"><CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{label}</CardDescription><CardTitle className="font-display text-3xl">{decimals ? value.toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : formatNumber(value)}</CardTitle></CardHeader></Card>;
}
