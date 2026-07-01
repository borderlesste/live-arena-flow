import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { ErrorState, EmptyState } from "@/components/feedback/States";
import { SourceStatusBadge, SourceKindBadge, PlaybackFormatBadge } from "./SourceStatusBadge";
import { CopyCredentialButton } from "./CopyCredentialButton";
import {
  Eye, EyeOff, RadioTower, RefreshCw, Plus, Pencil, Trash2, MoreVertical,
  Ban, Check, CheckCircle, ChevronsUpDown, Save, X, Loader2, ShieldCheck, Wifi, WifiOff,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ManagedVideoSource } from "@/services/video-sources.service";
import type { Match } from "@/types";
import type { ObsIngestMode, StreamCredentials } from "@/schemas/live-source.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateButtonState = "idle" | "provisioning" | "saving" | "done";

interface GeneralFormProps {
  eventDate: string;
  onEventDateChange: (date: string) => void;
  matches: Match[];
  selectedMatchId: string;
  onMatchChange: (id: string) => void;
  title: string;
  onTitleChange: (val: string) => void;
  titleError?: string;
  matchError?: string;
  playbackUrlError?: string;
  purpose: "live" | "highlight";
  onPurposeChange: (val: "live" | "highlight") => void;
  format: string;
  onFormatChange: (val: string) => void;
  playbackUrl: string;
  onPlaybackUrlChange: (val: string) => void;
  isObsEnabled: boolean;
  isEventsLoading: boolean;
  isEventsError: boolean;
  eventLabel: (id: string) => string;
  isEditing: boolean;
  onCancelEdit?: () => void;
  onSave: () => void;
  createState?: CreateButtonState;
}

interface MatchComboboxProps {
  matches: Match[];
  selectedMatchId: string;
  onMatchChange: (id: string) => void;
  eventLabel: (id: string) => string;
  matchError?: string;
}

function MatchCombobox({
  matches, selectedMatchId, onMatchChange, eventLabel, matchError,
}: MatchComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = selectedMatchId ? eventLabel(selectedMatchId) : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="source-event"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={Boolean(matchError)}
          aria-describedby={matchError ? "source-event-error" : undefined}
          className={cn(
            "min-w-0 w-full justify-between overflow-hidden bg-surface-2 px-3 font-normal hover:bg-surface-2",
            !selectedMatchId && "text-muted-foreground",
            matchError && "border-destructive",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel || "Buscar partido..."}</span>
          <ChevronsUpDown className="shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command label="Buscar partido">
          <CommandInput placeholder="Buscar por equipo o ID..." />
          <CommandList>
            <CommandEmpty>No se encontraron partidos.</CommandEmpty>
            <CommandGroup heading="Partidos disponibles">
              {matches.map((match) => {
                const label = eventLabel(match.id);
                return (
                  <CommandItem
                    key={match.id}
                    value={`${label} ${match.id}`}
                    onSelect={() => {
                      onMatchChange(match.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2", selectedMatchId === match.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


// ─── SourceGeneralForm ────────────────────────────────────────────────────────

export function SourceGeneralForm({
  eventDate, onEventDateChange, matches, selectedMatchId, onMatchChange,
  title, onTitleChange, titleError, matchError, playbackUrlError,
  purpose, onPurposeChange, format, onFormatChange,
  playbackUrl, onPlaybackUrlChange, isObsEnabled,
  isEventsLoading, isEventsError, eventLabel,
  isEditing, onCancelEdit, onSave, createState = "idle",
}: GeneralFormProps) {
  const isBusy = createState !== "idle" && createState !== "done";

  const buttonLabel: Record<CreateButtonState, string> = {
    idle: isEditing ? "Guardar cambios" : "Crear fuente",
    provisioning: "Creando entrada…",
    saving: "Guardando configuración…",
    done: "¡Fuente creada!",
  };

  const buttonIcon: Record<CreateButtonState, React.ReactNode> = {
    idle: isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />,
    provisioning: <Loader2 className="h-4 w-4 animate-spin" />,
    saving: <Loader2 className="h-4 w-4 animate-spin" />,
    done: <CheckCircle className="h-4 w-4" />,
  };

  return (
    <Card className="border border-border/40 bg-surface-1 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl font-bold">
          <Plus className="h-5 w-5 text-primary" />
          {isEditing ? "Editar fuente" : "Nueva fuente"}
        </CardTitle>
        <CardDescription>Información general del partido y formato de reproducción.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date + Match */}
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="source-date">Fecha partido</Label>
            <Input
              id="source-date"
              type="date"
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              className="bg-surface-2 border-border/60 focus-visible:ring-primary"
              aria-label="Fecha del partido"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="source-event">
              Partido <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            {isEventsLoading ? (
              <SkeletonLoader className="h-10 w-full" />
            ) : isEventsError ? (
              <p className="text-xs text-destructive" role="alert">Error al cargar partidos.</p>
            ) : (
              <MatchCombobox
                matches={matches}
                selectedMatchId={selectedMatchId}
                onMatchChange={onMatchChange}
                eventLabel={eventLabel}
                matchError={matchError}
              />
            )}
            {matchError && (
              <p id="source-event-error" className="text-xs text-destructive" role="alert">{matchError}</p>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="source-title">
            Nombre de la señal <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="source-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Señal Principal HD"
            className={cn("bg-surface-2 border-border/60 focus-visible:ring-primary", titleError && "border-destructive")}
            maxLength={100}
            aria-describedby={titleError ? "source-title-error" : undefined}
          />
          {titleError && (
            <p id="source-title-error" className="text-xs text-destructive" role="alert">{titleError}</p>
          )}
        </div>

        {/* Purpose + Format */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="source-purpose">Uso</Label>
            <Select value={purpose} onValueChange={(v) => onPurposeChange(v as "live" | "highlight")} disabled={isObsEnabled}>
              <SelectTrigger id="source-purpose" className="bg-surface-2 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-border">
                <SelectItem value="live">En vivo</SelectItem>
                <SelectItem value="highlight">Highlight / Grabación</SelectItem>
              </SelectContent>
            </Select>
            {isObsEnabled && (
              <p className="text-[10px] text-muted-foreground">Fijado en "En vivo" cuando OBS está activo.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source-type">Formato</Label>
            <Select value={isObsEnabled ? "hls" : format} onValueChange={onFormatChange} disabled={isObsEnabled}>
              <SelectTrigger id="source-type" className="bg-surface-2 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-border">
                <SelectItem value="hls">HLS (.m3u8)</SelectItem>
                <SelectItem value="mp4">MP4</SelectItem>
                <SelectItem value="mp3">MP3 / Audio</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="youtube_live">YouTube Live</SelectItem>
                <SelectItem value="embed">URL embed</SelectItem>
                <SelectItem value="iframe">Iframe autorizado</SelectItem>
              </SelectContent>
            </Select>
            {isObsEnabled && (
              <p className="text-[10px] text-muted-foreground">Formato fijado en HLS (salida del servidor RTMP).</p>
            )}
          </div>
        </div>

        {/* Custom OBS sources receive an independent HTTPS playback URL after creation. */}
        {!isObsEnabled || isEditing ? (
          <div className="space-y-1.5 animate-fadeIn">
            <Label htmlFor="source-playback">
              {isObsEnabled ? "URL HTTPS pública independiente" : "URL de reproducción"}
              {!isObsEnabled && <span className="text-destructive" aria-hidden="true">*</span>}
            </Label>
            <Input
              id="source-playback"
              type="url"
              value={playbackUrl}
              onChange={(e) => onPlaybackUrlChange(e.target.value)}
              placeholder="https://servidor.com/transmision.m3u8"
              className={cn("bg-surface-2 border-border/60 focus-visible:ring-primary", playbackUrlError && "border-destructive")}
              aria-describedby={playbackUrlError ? "source-playback-error" : undefined}
            />
            {playbackUrlError && (
              <p id="source-playback-error" className="text-xs text-destructive" role="alert">{playbackUrlError}</p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground animate-fadeIn" role="note">
            <span className="font-medium text-primary">OBS activo:</span> Cloudflare generará el HLS; el proveedor custom quedará sin publicación hasta configurar una URL HTTPS independiente.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            className={cn(
              "flex-1 font-semibold gap-1.5 transition-all",
              createState === "done"
                ? "bg-success text-success-foreground hover:bg-success/90"
                : "bg-primary text-primary-foreground hover:bg-primary-hover",
            )}
            onClick={onSave}
            disabled={isBusy}
            aria-busy={isBusy}
            aria-label={buttonLabel[createState]}
          >
            {buttonIcon[createState]}
            {buttonLabel[createState]}
          </Button>
          {isEditing && onCancelEdit && (
            <Button
              variant="ghost"
              className="border border-border/60 hover:bg-surface-2"
              onClick={onCancelEdit}
              disabled={isBusy}
              aria-label="Cancelar edición"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ObsPublishingOptions ─────────────────────────────────────────────────────

interface ObsOptionsProps {
  obsEnabled: boolean;
  onObsEnabledChange: (val: boolean) => void;
  obsProtocol: "rtmp" | "rtmps" | "srt";
  onObsProtocolChange: (val: "rtmp" | "rtmps" | "srt") => void;
  ingestMode: ObsIngestMode;
  onIngestModeChange: (val: ObsIngestMode) => void;
  recordingEnabled: boolean;
  onRecordingEnabledChange: (val: boolean) => void;
  lowLatencyEnabled: boolean;
  onLowLatencyEnabledChange: (val: boolean) => void;
  isEditing?: boolean;
}

export function ObsPublishingOptions({
  obsEnabled, onObsEnabledChange, obsProtocol, onObsProtocolChange,
  ingestMode, onIngestModeChange,
  recordingEnabled, onRecordingEnabledChange, lowLatencyEnabled, onLowLatencyEnabledChange,
  isEditing = false,
}: ObsOptionsProps) {
  return (
    <Card className="border border-border/40 bg-surface-1 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl font-bold">
          <RadioTower className="h-5 w-5 text-primary" />
          Publicar con OBS
        </CardTitle>
        <CardDescription>
          Configura y publica una transmisión en tiempo real desde OBS Studio u otro codificador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle principal */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="obs-toggle" className="text-sm font-semibold cursor-pointer">
              Activar publicación OBS
            </Label>
            <p className="text-xs text-muted-foreground">
              Genera un servidor y clave de ingesta RTMP/RTMPS/SRT reales.
            </p>
          </div>
          <Switch
            id="obs-toggle"
            checked={obsEnabled}
            onCheckedChange={onObsEnabledChange}
            aria-describedby="obs-toggle-desc"
          />
        </div>
        <p id="obs-toggle-desc" className="sr-only">
          Al activar OBS, se provisionará una entrada de streaming real en el servidor configurado.
        </p>

        {obsEnabled ? (
          <div className="space-y-4 animate-slideDown">
            <div className="space-y-1.5">
              <Label htmlFor="obs-ingest-mode">Ruta de la señal OBS</Label>
              <Select
                value={ingestMode}
                onValueChange={(value) => onIngestModeChange(value as ObsIngestMode)}
                disabled={isEditing}
              >
                <SelectTrigger id="obs-ingest-mode" className="bg-surface-2 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-border">
                  <SelectItem value="configured">Ruta predeterminada del servidor</SelectItem>
                  <SelectItem value="direct_cloudflare">Directo a Cloudflare (sin Restream)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {ingestMode === "direct_cloudflare"
                  ? "OBS publicará directamente en Cloudflare Stream; Restream no interviene."
                  : "Usa STREAM_PROVIDER; puede incluir el puente Restream → Cloudflare."}
              </p>
            </div>

            {/* Protocolo */}
            <div className="space-y-1.5">
              <Label htmlFor="obs-protocol">Protocolo de ingestión</Label>
              <Select value="rtmps" onValueChange={onObsProtocolChange as (v: string) => void} disabled>
                <SelectTrigger id="obs-protocol" className="bg-surface-2 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-border">
                  <SelectItem value="rtmps">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      RTMPS — Puerto 443, cifrado TLS (Recomendado)
                    </span>
                  </SelectItem>
                  <SelectItem value="rtmp">RTMP — Puerto 1935, sin cifrar</SelectItem>
                  <SelectItem value="srt">SRT — Baja latencia (experimental)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opciones adicionales */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-surface-2/40 p-2.5">
                <div>
                  <Label htmlFor="obs-recording" className="text-xs font-medium cursor-pointer">
                    Grabación automática
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Guarda la emisión al finalizar (si el servidor lo soporta).</p>
                </div>
                <Switch id="obs-recording" checked={recordingEnabled} onCheckedChange={onRecordingEnabledChange} disabled />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-surface-2/40 p-2.5">
                <div>
                  <Label htmlFor="obs-latency" className="text-xs font-medium cursor-pointer">
                    Baja latencia
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Requiere OBS con fotogramas clave cada 2–4 s y B-frames en 0.
                  </p>
                </div>
                <Switch id="obs-latency" checked={lowLatencyEnabled} onCheckedChange={onLowLatencyEnabledChange} />
              </div>
            </div>

            {/* Aviso informativo */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground space-y-1">
              <p className="font-semibold text-primary text-xs">¿Cómo funciona?</p>
              <p>
                Al crear la fuente, el servidor generará un <strong>servidor de ingestión</strong> y una{" "}
                <strong>clave de transmisión</strong> cifrada. Cópialos en OBS Studio:
              </p>
              <p className="text-[10px] font-mono bg-surface-2 rounded px-2 py-1 mt-1">
                Ajustes → Emisión → Servicio: Personalizado
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                La URL de reproducción HLS se generará automáticamente a partir del servidor y la clave.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-surface-2/30 p-4 text-center text-xs text-muted-foreground">
            <RadioTower className="h-8 w-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
            <p>Activa el interruptor para configurar la emisión en vivo con OBS Studio, vMix u otro codificador externo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── StreamCredentialsPanel ───────────────────────────────────────────────────

interface CredentialsPanelProps {
  source: ManagedVideoSource | null;
  onReveal: () => Promise<void>;
  onRotate: () => void;
  revealedKey: string | null;
  relayDestination?: StreamCredentials | null;
  isRevealing: boolean;
  isRotating: boolean;
  isProvisioning: boolean;
}

export function StreamCredentialsPanel({
  source, onReveal, onRotate, revealedKey, relayDestination = null, isRevealing, isRotating, isProvisioning,
}: CredentialsPanelProps) {
  const [showKey, setShowKey] = useState(false);

  // Reset showKey whenever the source changes or revealedKey is cleared
  // (parent sets revealedKey=null when switching sources)
  const prevSourceId = useRef<string | null>(null);
  useEffect(() => {
    if (source?.id !== prevSourceId.current) {
      setShowKey(false);
      prevSourceId.current = source?.id ?? null;
    }
  }, [source?.id]);

  // Also reset when revealedKey is explicitly cleared
  useEffect(() => {
    if (!revealedKey) setShowKey(false);
  }, [revealedKey]);

  const handleRevealToggle = async () => {
    if (!showKey && !revealedKey) await onReveal();
    setShowKey((prev) => !prev);
  };

  // Estado vacío — antes de seleccionar/crear fuente
  if (!source) {
    return (
      <Card className="border border-dashed border-border bg-surface-1/40 flex items-center justify-center min-h-[300px] text-center p-6">
        <div>
          <RadioTower className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-muted-foreground/70 text-sm">Credenciales de transmisión</h3>
          <p className="text-xs text-muted-foreground/50 max-w-[220px] mx-auto mt-1 leading-relaxed">
            Crea una fuente OBS o selecciona una existente para ver los detalles de emisión.
          </p>
        </div>
      </Card>
    );
  }

  // Skeleton durante aprovisionamiento
  if (isProvisioning) {
    return (
      <Card className="border border-border/40 bg-surface-1 shadow-xl min-h-[300px]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            <CardTitle className="text-xl font-bold font-display">Aprovisionando señal…</CardTitle>
          </div>
          <CardDescription>El servidor está preparando la entrada de transmisión.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3" aria-live="polite" aria-busy="true">
          <SkeletonLoader className="h-5 w-1/3" />
          <SkeletonLoader className="h-10 w-full" />
          <SkeletonLoader className="h-10 w-full" />
          <SkeletonLoader className="h-10 w-full" />
          <SkeletonLoader className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isManual = source.sourceKind !== "obs";
  const isRestreamCloudflare = source.provider === "restream_cloudflare";

  return (
    <Card className="border border-border/40 bg-surface-1 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="font-display text-xl font-bold">Detalles de transmisión</CardTitle>
            <CardDescription className="text-xs truncate max-w-[200px]">{source.title}</CardDescription>
          </div>
          <SourceStatusBadge status={source.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isManual ? (
          /* ── Fuente manual ── */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL de reproducción</Label>
              <div className="flex gap-2">
                <Input
                  value={source.playbackUrl || source.url || ""}
                  readOnly
                  className="bg-surface-2 border-border/60 font-mono text-xs truncate"
                  aria-label="URL de reproducción"
                />
                <CopyCredentialButton
                  value={source.playbackUrl || source.url || ""}
                  label="URL de reproducción"
                  size="icon"
                  variant="secondary"
                />
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 border border-border/60 p-3 space-y-1">
              <p className="text-xs font-semibold">Fuente manual configurada</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta señal se reproduce directamente desde la URL de CDN proporcionada. No utiliza ingesta OBS interna.
              </p>
            </div>
          </div>
        ) : (
          /* ── Fuente OBS ── */
          <div className="space-y-3">
            {/* Servidor OBS */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground" id="lbl-ingest">
                Servidor OBS (Ingest URL)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={source.ingestUrl || ""}
                  readOnly
                  className="bg-surface-2 border-border/60 font-mono text-xs truncate"
                  aria-labelledby="lbl-ingest"
                />
                <CopyCredentialButton
                  value={source.ingestUrl || ""}
                  label="Servidor OBS"
                  size="icon"
                  variant="secondary"
                />
              </div>
            </div>

            {/* Clave de transmisión */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground" id="lbl-key">
                Clave de transmisión
              </Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={
                    showKey
                      ? (revealedKey || "")
                      : `••••••••••••${source.streamKeyLast4 || ""}`
                  }
                  readOnly
                  className="bg-surface-2 border-border/60 font-mono text-xs"
                  aria-labelledby="lbl-key"
                  aria-live={showKey ? "polite" : undefined}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleRevealToggle}
                        disabled={isRevealing}
                        aria-label={showKey ? "Ocultar clave de transmisión" : "Revelar clave de transmisión"}
                      >
                        {isRevealing
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : showKey
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showKey ? "Ocultar clave" : "Revelar clave"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <CopyCredentialButton
                  value={revealedKey || undefined}
                  label="Clave de transmisión"
                  size="icon"
                  variant="secondary"
                />
              </div>
              {!revealedKey && !showKey && (
                <p className="text-[10px] text-muted-foreground">
                  Pulsa el icono de ojo para revelar la clave completa. Se requiere autorización.
                </p>
              )}
            </div>

            {/* URL HLS de reproducción */}
            {isRestreamCloudflare ? (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Destino Cloudflare para Restream</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Registra estos datos como un canal Custom RTMP en Restream. No los pegues en OBS.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="relay-ingest-url">
                    Servidor RTMPS de Cloudflare
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="relay-ingest-url"
                      value={relayDestination?.ingestUrl || "Revela las credenciales para cargar el destino"}
                      readOnly
                      className="bg-surface-2 border-border/60 font-mono text-xs truncate"
                    />
                    <CopyCredentialButton
                      value={relayDestination?.ingestUrl}
                      label="Servidor Cloudflare"
                      size="icon"
                      variant="secondary"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="relay-stream-key">
                    Clave del destino Cloudflare
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="relay-stream-key"
                      type={showKey ? "text" : "password"}
                      value={showKey ? (relayDestination?.streamKey || "") : "••••••••••••••••"}
                      readOnly
                      className="bg-surface-2 border-border/60 font-mono text-xs"
                    />
                    <CopyCredentialButton
                      value={relayDestination?.streamKey}
                      label="Clave Cloudflare"
                      size="icon"
                      variant="secondary"
                    />
                  </div>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  <li>En Restream abre <strong>Channels → Add New → Custom RTMP</strong>.</li>
                  <li>Copia el servidor y la clave Cloudflare mostrados arriba.</li>
                  <li>Activa ese canal antes de iniciar OBS.</li>
                </ol>
              </div>
            ) : null}

            {source.playbackUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground" id="lbl-hls">
                  URL HLS de reproducción pública
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={source.playbackUrl}
                    readOnly
                    className="bg-surface-2 border-border/60 font-mono text-xs truncate"
                    aria-labelledby="lbl-hls"
                  />
                  <CopyCredentialButton
                    value={source.playbackUrl}
                    label="URL HLS"
                    size="icon"
                    variant="secondary"
                  />
                </div>
              </div>
            )}

            {/* Rotar clave */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRotate}
              disabled={isRotating}
              className="w-full text-xs border-warning/30 text-warning hover:bg-warning/10 hover:text-warning gap-1.5"
              aria-label={isRestreamCloudflare ? "Recrear destino Cloudflare" : "Rotar clave de transmisión OBS"}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRotating && "animate-spin")} />
              {isRotating
                ? "Actualizando credenciales…"
                : isRestreamCloudflare
                  ? "Recrear destino Cloudflare"
                  : "Rotar clave OBS"}
            </Button>

            {/* Guía OBS Studio */}
            <div className="rounded-lg bg-surface-2 border border-border/60 p-3 text-[11px] leading-relaxed text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground text-xs border-b border-border/40 pb-1">
                Configuración en OBS Studio
              </p>
              <ol className="list-decimal list-inside space-y-1" aria-label="Pasos para configurar OBS Studio">
                <li>Abre <strong>Ajustes → Emisión</strong>.</li>
                <li>Servicio: selecciona <strong>Personalizado</strong>.</li>
                <li>Servidor: copia el valor de <strong>Servidor OBS</strong> de arriba.</li>
                <li>Clave de transmisión: copia la <strong>Clave</strong> (revelar primero).</li>
                <li>Aplica y pulsa <strong>Iniciar transmisión</strong>.</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ConfiguredSourcesList ────────────────────────────────────────────────────

interface ListProps {
  sources: ManagedVideoSource[];
  eventLabel: (id: string) => string;
  onEdit: (src: ManagedVideoSource) => void;
  onDelete: (src: ManagedVideoSource) => void;
  onRotate: (src: ManagedVideoSource) => void;
  onToggleEnabled: (src: ManagedVideoSource) => void;
  onSetPrimary: (src: ManagedVideoSource) => void;
  selectedSourceId?: string;
  onSelect: (src: ManagedVideoSource) => void;
}

export function ConfiguredSourcesList({
  sources, eventLabel, onEdit, onDelete, onRotate,
  onToggleEnabled, onSetPrimary, selectedSourceId, onSelect,
}: ListProps) {
  if (sources.length === 0) {
    return (
      <EmptyState
        title="Aún no hay fuentes configuradas"
        description="Crea una fuente manual o de transmisión OBS arriba para asociarla a un evento deportivo."
        className="py-12 border border-border/40 bg-surface-1 shadow-md rounded-lg"
      />
    );
  }

  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Fuentes de transmisión configuradas"
    >
      {sources.map((source) => {
        const isSelected = selectedSourceId === source.id;
        const isActive = source.isEnabled !== false;
        const displayUrl = source.playbackUrl || source.url || "";

        return (
          <li key={source.id}>
            <Card
              onClick={() => onSelect(source)}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`Fuente: ${source.title}. Estado: ${source.status ?? "desconocido"}. ${isSelected ? "Seleccionada." : "Pulsa para seleccionar."}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(source); } }}
              className={cn(
                "border border-border/40 bg-surface-1 hover:border-primary/40 transition-all duration-200",
                "shadow hover:shadow-lg cursor-pointer relative overflow-hidden group focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl",
                isSelected && "ring-2 ring-primary/60 border-primary/60",
                !isActive && "opacity-60",
              )}
            >
              {/* Badge "Principal" */}
              {source.isPrimary && (
                <div
                  className="absolute top-0 right-0 bg-primary/20 text-primary border-l border-b border-primary/20 text-[9px] font-bold px-2 py-0.5 rounded-bl-md flex items-center gap-1"
                  aria-label="Fuente principal"
                >
                  <CheckCircle className="h-2.5 w-2.5" aria-hidden="true" />
                  Principal
                </div>
              )}

              <CardContent className="p-4 flex flex-col justify-between min-h-[160px]">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="font-display font-bold text-base truncate leading-snug group-hover:text-primary transition-colors">
                        {source.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {eventLabel(source.matchId)}
                      </p>
                    </div>

                    {/* Menú de acciones — stopPropagation para no activar onSelect */}
                    <div
                      className="absolute top-2 right-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`Acciones para ${source.title}`}
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface-2 border-border text-foreground w-48">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border/60" />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(source); }} className="gap-2 cursor-pointer">
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Editar metadatos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleEnabled(source); }} className="gap-2 cursor-pointer">
                            {isActive
                              ? <><WifiOff className="h-3.5 w-3.5" aria-hidden="true" />Desactivar señal</>
                              : <><Wifi className="h-3.5 w-3.5" aria-hidden="true" />Activar señal</>}
                          </DropdownMenuItem>
                          {source.sourceKind === "obs" && (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); onRotate(source); }}
                              className="gap-2 cursor-pointer text-warning focus:text-warning"
                            >
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                              Rotar clave OBS
                            </DropdownMenuItem>
                          )}
                          {!source.isPrimary && (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); onSetPrimary(source); }}
                              className="gap-2 cursor-pointer text-primary focus:text-primary"
                            >
                              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Marcar como principal
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-border/60" />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(source); }}
                            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Eliminar fuente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <SourceKindBadge kind={source.sourceKind} />
                    <PlaybackFormatBadge
                      format={source.sourceKind === "obs" ? "obs_hls" : source.type}
                    />
                    <SourceStatusBadge status={source.status} className="ml-auto shrink-0" />
                  </div>
                </div>

                {/* Footer: URL truncada + last4 */}
                <div className="mt-4 border-t border-border/40 pt-2 flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]"
                    title={displayUrl}
                  >
                    {displayUrl || "—"}
                  </span>
                  {source.sourceKind === "obs" && source.streamKeyLast4 && (
                    <span className="shrink-0 text-[10px] bg-surface-2 px-1.5 py-0.5 rounded font-mono border border-border/40 text-muted-foreground">
                      Key: ••••{source.streamKeyLast4}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
