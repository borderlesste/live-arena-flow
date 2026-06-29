import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useLiveSportsWindow, useSportsDate, useSportsWindow } from "@/hooks/useSportsData";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { ErrorState } from "@/components/feedback/States";
import { getSessionToken } from "@/services/auth.service";
import { BrandSettingsPanel } from "@/components/admin/BrandSettingsPanel";
import type { SportsDataBundle } from "@/services/sports-data.mapper";
import {
  createLiveSource,
  listManagedVideoSources,
  saveManagedVideoSource,
  deleteManagedVideoSource,
  revealCredentials,
  rotateCredentials,
  enableLiveSource,
  disableLiveSource,
  listLiveSourcesStatuses,
  type ManagedVideoSource,
} from "@/services/video-sources.service";
import {
  SourceGeneralForm,
  ObsPublishingOptions,
  StreamCredentialsPanel,
  ConfiguredSourcesList,
  type CreateButtonState,
} from "@/components/admin/StreamAdminComponents";
import { DeleteSourceDialog, RotateStreamKeyDialog } from "@/components/admin/StreamDialogs";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function mergeSportsBundles(...bundles: SportsDataBundle[]): SportsDataBundle {
  const matches = new Map<string, SportsDataBundle["matches"][number]>();
  const teams = new Map<string, SportsDataBundle["teams"][number]>();
  const competitions = new Map<string, SportsDataBundle["competitions"][number]>();
  for (const bundle of bundles) {
    bundle.matches.forEach((m) => matches.set(m.id, m));
    bundle.teams.forEach((t) => teams.set(t.id, t));
    bundle.competitions.forEach((c) => competitions.set(c.id, c));
  }
  return {
    matches: [...matches.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    teams: [...teams.values()],
    competitions: [...competitions.values()],
  };
}

/** Validation errors for the create/edit form */
interface FormErrors {
  match?: string;
  title?: string;
  playbackUrl?: string;
}

const AdminPage = () => {
  useDocumentMeta({
    title: "Administración de Emisión",
    description: "Gestiona fuentes de vídeo y configuración OBS por partido.",
  });

  const windowQuery = useSportsWindow();
  const liveQuery = useLiveSportsWindow();
  const [eventDate, setEventDate] = useState(todayKey);
  const dateQuery = useSportsDate(eventDate);
  const auth = useAuth();
  const queryClient = useQueryClient();

  // ── Sources state ────────────────────────────────────────────────────────
  const [sources, setSources] = useState<ManagedVideoSource[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  // ── Selection / Editing ───────────────────────────────────────────────────
  const [selectedSource, setSelectedSource] = useState<ManagedVideoSource | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [matchId, setMatchId] = useState("");
  const [title, setTitle] = useState("Transmisión Principal");
  const [purpose, setPurpose] = useState<"live" | "highlight">("live");
  const [format, setFormat] = useState<string>("hls");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // ── OBS form state ────────────────────────────────────────────────────────
  const [obsEnabled, setObsEnabled] = useState(false);
  const [obsProtocol, setObsProtocol] = useState<"rtmp" | "rtmps" | "srt">("rtmps");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [lowLatencyEnabled, setLowLatencyEnabled] = useState(false);

  // ── Create button state (for progressive UI) ──────────────────────────────
  const [createState, setCreateState] = useState<CreateButtonState>("idle");

  // ── Credential state ──────────────────────────────────────────────────────
  const [isRevealing, setIsRevealing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);
  const [dialogSource, setDialogSource] = useState<ManagedVideoSource | null>(null);

  /**
   * Idempotency key per submit attempt — changes on every new create,
   * stays the same during the same operation to prevent double-click duplicates.
   */
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const bundle = useMemo(
    () => mergeSportsBundles(windowQuery.bundle, dateQuery.bundle, liveQuery.bundle),
    [dateQuery.bundle, liveQuery.bundle, windowQuery.bundle],
  );
  const isEventsLoading =
    (windowQuery.isLoading || dateQuery.isLoading || liveQuery.isLoading) &&
    bundle.matches.length === 0;
  const isEventsError = windowQuery.isError && dateQuery.isError && liveQuery.isError;
  const teams = useMemo(
    () => new Map(bundle.teams.map((t) => [t.id, t])),
    [bundle.teams],
  );
  const token = getSessionToken() ?? "";
  const canAdmin =
    auth.profile?.role === "super_admin" || auth.profile?.role === "admin";

  // ── Load sources ──────────────────────────────────────────────────────────
  const loadSources = useCallback(async () => {
    if (!token || !canAdmin) { setSources([]); return; }
    try {
      const list = await listManagedVideoSources(token);
      setSources(list);
      setSourcesError(null);
    } catch (err) {
      setSourcesError(err instanceof Error ? err.message : "No se pudieron cargar las fuentes");
    }
  }, [token, canAdmin]);

  useEffect(() => { void loadSources(); }, [loadSources]);

  // ── Polling for OBS status ────────────────────────────────────────────────
  // sources.length (not sources) is intentional: we only restart the interval
  // when the count changes, not on every status update, to avoid re-subscription loops.
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      if (!active || document.visibilityState === "hidden" || !token || !canAdmin) return;
      const obsSources = sources.filter((s) => s.sourceKind === "obs");
      if (obsSources.length === 0) return;
      try {
        const statuses = await listLiveSourcesStatuses(token);
        setSources((prev) =>
          prev.map((s) => {
            const found = statuses.find((item) => item.id === s.id);
            return found ? { ...s, status: found.status } : s;
          }),
        );
        setSelectedSource((curr) => {
          if (!curr) return null;
          const found = statuses.find((item) => item.id === curr.id);
          return found ? { ...curr, status: found.status } : curr;
        });
      } catch {
        // fail silently — polling errors shouldn't interrupt the admin
      }
    }, 5000);
    return () => { active = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sources.length is intentional; see comment above
  }, [token, canAdmin, sources.length]);

  const eventLabel = useCallback(
    (id: string) => {
      const match = bundle.matches.find((m) => m.id === id);
      if (!match) return `Evento ${id}`;
      return `${teams.get(match.homeTeamId)?.name ?? "Local"} vs ${teams.get(match.awayTeamId)?.name ?? "Visitante"}`;
    },
    [bundle.matches, teams],
  );

  // Default matchId when bundle updates
  useEffect(() => {
    if (bundle.matches.length > 0 && !matchId) {
      setMatchId(bundle.matches[0].id);
    }
  }, [bundle.matches, matchId]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setFormId(undefined);
    setMatchId(bundle.matches[0]?.id || "");
    setTitle("Transmisión Principal");
    setPurpose("live");
    setFormat("hls");
    setPlaybackUrl("");
    setObsEnabled(false);
    setObsProtocol("rtmps");
    setRecordingEnabled(false);
    setLowLatencyEnabled(false);
    setRevealedKey(null);
    setIsEditing(false);
    setFormErrors({});
    setCreateState("idle");
    // Rotate idempotency key for the next create operation
    idempotencyKeyRef.current = crypto.randomUUID();
  }, [bundle.matches]);

  const handleEdit = (source: ManagedVideoSource) => {
    setIsEditing(true);
    setFormId(source.id);
    setMatchId(source.matchId);
    setTitle(source.title);
    setPurpose(source.usageType === "highlight" ? "highlight" : "live");
    setFormat(source.sourceKind === "obs" ? "hls" : source.type);
    setPlaybackUrl(source.playbackUrl || source.url || source.embedUrl || "");
    setObsEnabled(source.sourceKind === "obs");
    setObsProtocol(source.ingestProtocol || "rtmps");
    setRecordingEnabled(source.recordingEnabled === true);
    setLowLatencyEnabled(source.lowLatencyEnabled === true);
    setRevealedKey(null);
    setFormErrors({});
    setCreateState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Validates the form; returns true if valid, sets formErrors otherwise. */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!matchId) errors.match = "Selecciona un partido.";
    if (!title.trim()) errors.title = "Introduce un nombre para la señal.";
    if (title.trim().length > 100) errors.title = "El nombre no puede superar los 100 caracteres.";
    if (!obsEnabled && !playbackUrl.trim()) {
      errors.playbackUrl = "Introduce la URL de reproducción.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Main save handler ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (createState !== "idle" && createState !== "done") return; // guard double-click
    if (!validateForm()) return;

    if (isEditing && formId) {
      // ── Edit existing source ───────────────────────────────────────────
      setCreateState("saving");
      const patch: Partial<ManagedVideoSource> = {
        matchId,
        title: title.trim(),
        usageType: obsEnabled ? "live" : purpose,
      };
      if (!obsEnabled || playbackUrl.trim()) {
        patch.playbackUrl = playbackUrl.trim();
      }
      try {
        const updatedList = await saveManagedVideoSource({ id: formId, ...patch }, token, true);
        setSources(updatedList);
        await queryClient.invalidateQueries({ queryKey: ["sportsdb"] });
        toast.success("Fuente actualizada correctamente");
        resetForm();
      } catch (err) {
        setCreateState("idle");
        toast.error(err instanceof Error ? err.message : "Error al guardar la fuente");
      }
      return;
    }

    // ── Create new source ──────────────────────────────────────────────────
    // Lock: same idempotency key used while this operation runs
    const currentIdempotencyKey = idempotencyKeyRef.current;

    if (obsEnabled) {
      setCreateState("provisioning");
    } else {
      setCreateState("saving");
    }

    try {
      const created = await createLiveSource(
        {
          matchId,
          title: title.trim(),
          sourceKind: obsEnabled ? "obs" : "manual",
          usageType: obsEnabled ? "live" : purpose,
          playbackFormat: obsEnabled ? "hls" : format,
          playbackUrl: obsEnabled ? undefined : playbackUrl.trim(),
          ingestProtocol: obsEnabled ? obsProtocol : undefined,
          recordingEnabled: obsEnabled ? recordingEnabled : undefined,
          lowLatencyEnabled: obsEnabled ? lowLatencyEnabled : undefined,
          idempotencyKey: currentIdempotencyKey,
        },
        token,
      );

      if (obsEnabled) {
        setCreateState("saving");
        // Small delay to show the "saving" state
        await new Promise((r) => setTimeout(r, 400));
      }

      setCreateState("done");

      // Reload list
      const updatedList = await listManagedVideoSources(token);
      setSources(updatedList);

      // Select newly created source and show credentials immediately
      const freshSource = updatedList.find((s) => s.id === created.source.id) ?? created.source;
      setSelectedSource(freshSource);

      // Credentials are returned once for a new provisioning response only.
      setRevealedKey(created.credentials?.streamKey ?? null);

      await queryClient.invalidateQueries({ queryKey: ["sportsdb"] });
      toast.success(
        obsEnabled
          ? created.replayed
            ? "La solicitud ya había sido procesada. Usa Revelar clave si la necesitas."
            : "Fuente OBS creada. Copia el servidor y la clave en OBS Studio."
          : "Fuente de transmisión creada correctamente.",
      );

      // Reset form after brief "done" display
      setTimeout(() => resetForm(), 1500);
    } catch (err) {
      setCreateState("idle");
      // Rotate idempotency key so the admin can retry cleanly
      idempotencyKeyRef.current = crypto.randomUUID();
      toast.error(err instanceof Error ? err.message : "Error al crear la fuente");
    }
  };

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleDeleteTrigger = (source: ManagedVideoSource) => {
    setDialogSource(source);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dialogSource) return;
    try {
      const updatedList = await deleteManagedVideoSource(dialogSource.id, token);
      setSources(updatedList);
      if (selectedSource?.id === dialogSource.id) setSelectedSource(null);
      await queryClient.invalidateQueries({ queryKey: ["sportsdb"] });
      toast.success("Fuente eliminada correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la fuente");
    } finally {
      setIsDeleteDialogOpen(false);
      setDialogSource(null);
    }
  };

  // ── Rotate handlers ───────────────────────────────────────────────────────
  const handleRotateTrigger = (source: ManagedVideoSource) => {
    setDialogSource(source);
    setIsRotateDialogOpen(true);
  };

  const handleRotateConfirm = async () => {
    if (!dialogSource) return;
    setIsRotating(true);
    try {
      const result = await rotateCredentials(dialogSource.id, token);
      setRevealedKey(result.streamKey);
      toast.success("Clave de transmisión rotada. Configura la nueva clave en OBS.");
      await loadSources();
      setSelectedSource((curr) =>
        curr
          ? { ...curr, streamKeyLast4: result.streamKey.slice(-4), ingestUrl: result.ingestUrl }
          : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rotar credenciales");
    } finally {
      setIsRotating(false);
      setIsRotateDialogOpen(false);
      setDialogSource(null);
    }
  };

  // ── Reveal credentials ────────────────────────────────────────────────────
  const handleReveal = async () => {
    if (!selectedSource) return;
    setIsRevealing(true);
    try {
      const result = await revealCredentials(selectedSource.id, token);
      setRevealedKey(result.streamKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al revelar la clave");
    } finally {
      setIsRevealing(false);
    }
  };

  // ── Toggle enable/disable ─────────────────────────────────────────────────
  const handleToggleEnabled = async (source: ManagedVideoSource) => {
    const isCurrentlyEnabled = source.isEnabled !== false;
    try {
      if (isCurrentlyEnabled) {
        await disableLiveSource(source.id, token);
        toast.info("Señal desactivada");
      } else {
        await enableLiveSource(source.id, token);
        toast.success("Señal activada");
      }
      await loadSources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
    }
  };

  // ── Set primary ───────────────────────────────────────────────────────────
  const handleSetPrimary = async (source: ManagedVideoSource) => {
    try {
      await saveManagedVideoSource({ id: source.id, isPrimary: true }, token, true);
      toast.success("Fuente marcada como principal para el partido");
      await loadSources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al marcar principal");
    }
  };

  async function refreshEvents() {
    await Promise.all([windowQuery.refetch(), dateQuery.refetch(), liveQuery.refetch()]);
    toast.success("Listado de partidos actualizado");
  }

  // ── OBS toggle: force "live" usage and clear playbackUrl field ────────────
  const handleObsEnabledChange = (val: boolean) => {
    setObsEnabled(val);
    if (val) {
      setPurpose("live");
      setFormat("hls");
      setPlaybackUrl("");
      setFormErrors((prev) => ({ ...prev, playbackUrl: undefined }));
    }
  };

  // ── Loading / access guard ────────────────────────────────────────────────
  if (auth.isLoading) {
    return (
      <section className="space-y-4 py-8">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-48 w-full" />
        <SkeletonLoader className="h-96 w-full" />
      </section>
    );
  }

  if (!auth.authenticated || !canAdmin) {
    return (
      <section className="py-12">
        <ErrorState
          title={!auth.authenticated ? "Inicia sesión" : "Acceso restringido"}
          description={
            !auth.authenticated
              ? "Debes autenticarte para acceder al panel de administración."
              : "Tu cuenta no tiene privilegios administrativos."
          }
        />
      </section>
    );
  }

  const isBusy = createState === "provisioning" || createState === "saving";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">
            Panel de control
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Fuentes de transmisión</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Asocia señales en vivo, emisiones OBS y vídeos a partidos deportivos.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-border/60 hover:bg-surface-2 gap-1.5"
          onClick={() => void refreshEvents()}
          aria-label="Actualizar lista de partidos"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar partidos
        </Button>
      </header>

      {/* Error banner */}
      {sourcesError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Error al cargar fuentes</AlertTitle>
          <AlertDescription>{sourcesError}</AlertDescription>
        </Alert>
      )}

      {/* Brand settings panel */}
      <BrandSettingsPanel token={token} />

      {/* ── 3-Column grid ── */}
      <div
        className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Configuración de nueva fuente"
      >
        {/* Col 1 — Información general */}
        <SourceGeneralForm
          eventDate={eventDate}
          onEventDateChange={setEventDate}
          matches={bundle.matches}
          selectedMatchId={matchId}
          onMatchChange={setMatchId}
          title={title}
          onTitleChange={setTitle}
          titleError={formErrors.title}
          matchError={formErrors.match}
          playbackUrlError={formErrors.playbackUrl}
          purpose={purpose}
          onPurposeChange={setPurpose}
          format={format}
          onFormatChange={setFormat}
          playbackUrl={playbackUrl}
          onPlaybackUrlChange={setPlaybackUrl}
          isObsEnabled={obsEnabled}
          isEventsLoading={isEventsLoading}
          isEventsError={isEventsError}
          eventLabel={eventLabel}
          isEditing={isEditing}
          onCancelEdit={resetForm}
          onSave={handleSave}
          createState={createState}
        />

        {/* Col 2 — Opciones OBS */}
        <ObsPublishingOptions
          obsEnabled={obsEnabled}
          onObsEnabledChange={handleObsEnabledChange}
          obsProtocol={obsProtocol}
          onObsProtocolChange={setObsProtocol}
          recordingEnabled={recordingEnabled}
          onRecordingEnabledChange={setRecordingEnabled}
          lowLatencyEnabled={lowLatencyEnabled}
          onLowLatencyEnabledChange={setLowLatencyEnabled}
        />

        {/* Col 3 — Credenciales */}
        <StreamCredentialsPanel
          source={selectedSource}
          onReveal={handleReveal}
          onRotate={() => selectedSource && handleRotateTrigger(selectedSource)}
          revealedKey={revealedKey}
          isRevealing={isRevealing}
          isRotating={isRotating}
          isProvisioning={
            isBusy && obsEnabled && !selectedSource
              ? false
              : selectedSource?.status === "provisioning"
          }
        />
      </div>

      {/* ── Fuentes configuradas (ancho completo) ── */}
      <div className="space-y-4 border-t border-border/40 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Fuentes configuradas</h2>
          <Badge variant="secondary" className="px-2 py-0.5 tabular-nums">
            {sources.length}
          </Badge>
        </div>

        <ConfiguredSourcesList
          sources={sources}
          eventLabel={eventLabel}
          onEdit={handleEdit}
          onDelete={handleDeleteTrigger}
          onRotate={handleRotateTrigger}
          onToggleEnabled={handleToggleEnabled}
          onSetPrimary={handleSetPrimary}
          selectedSourceId={selectedSource?.id}
          onSelect={(src) => {
            setSelectedSource(src);
            setRevealedKey(null);
          }}
        />
      </div>

      {/* Dialogs */}
      <DeleteSourceDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        sourceName={dialogSource?.title || ""}
        isLive={dialogSource?.status === "live"}
      />
      <RotateStreamKeyDialog
        isOpen={isRotateDialogOpen}
        onClose={() => setIsRotateDialogOpen(false)}
        onConfirm={handleRotateConfirm}
        sourceName={dialogSource?.title || ""}
        isLive={dialogSource?.status === "live"}
      />
    </section>
  );
};

export default AdminPage;
