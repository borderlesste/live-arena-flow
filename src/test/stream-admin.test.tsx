/**
 * Tests for the streaming admin page components.
 * Uses jsdom + @testing-library/react — no real HTTP calls or stream keys.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SourceGeneralForm } from "@/components/admin/StreamAdminComponents";
import { ObsPublishingOptions } from "@/components/admin/StreamAdminComponents";
import { StreamCredentialsPanel } from "@/components/admin/StreamAdminComponents";
import { ConfiguredSourcesList } from "@/components/admin/StreamAdminComponents";
import type { ManagedVideoSource } from "@/services/video-sources.service";
import type { Match } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
HTMLElement.prototype.scrollIntoView = vi.fn();

const noop = () => {};
const asyncNoop = async () => {};

const testMatch: Match = {
  id: "m1",
  sport: "football",
  competitionId: "league-1",
  homeTeamId: "h1",
  awayTeamId: "a1",
  homeScore: 0,
  awayScore: 0,
  status: "scheduled",
  startsAt: "2026-06-25T20:00:00Z",
  venue: "Estadio Test",
  streams: [],
};

const secondTestMatch: Match = {
  ...testMatch,
  id: "m2",
  homeTeamId: "h2",
  awayTeamId: "a2",
};

const defaultFormProps = {
  eventDate: "2026-06-25",
  onEventDateChange: noop,
  matches: [testMatch],
  selectedMatchId: "m1",
  onMatchChange: noop,
  title: "Señal Principal",
  onTitleChange: noop,
  purpose: "live" as const,
  onPurposeChange: noop,
  format: "hls",
  onFormatChange: noop,
  playbackUrl: "",
  onPlaybackUrlChange: noop,
  isObsEnabled: false,
  isEventsLoading: false,
  isEventsError: false,
  eventLabel: (id: string) => `Partido ${id}`,
  isEditing: false,
  onSave: noop,
  createState: "idle" as const,
};

const obsSource: ManagedVideoSource = {
  id: "src-1",
  matchId: "m1",
  title: "OBS Signal HD",
  type: "obs_hls",
  isExternal: false,
  sourceKind: "obs",
  usageType: "live",
  ingestProtocol: "rtmps",
  ingestUrl: "rtmps://ingest.example.com:443/live",
  streamKeyLast4: "A92F",
  playbackUrl: "https://cdn.example.com/live/abc123/index.m3u8",
  status: "ready",
  createdAt: "2026-06-25T10:00:00Z",
};

const manualSource: ManagedVideoSource = {
  id: "src-2",
  matchId: "m1",
  title: "Manual HLS",
  type: "hls",
  isExternal: false,
  sourceKind: "manual",
  usageType: "live",
  url: "https://cdn.example.com/stream.m3u8",
  playbackUrl: "https://cdn.example.com/stream.m3u8",
  status: "ready",
  createdAt: "2026-06-25T09:00:00Z",
};

// ── SourceGeneralForm tests ────────────────────────────────────────────────────

describe("SourceGeneralForm", () => {
  it("renders all form fields in idle state", () => {
    render(<SourceGeneralForm {...defaultFormProps} />);
    expect(screen.getByLabelText(/fecha partido/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /partido/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre de la señal/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /uso/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /formato/i })).toBeInTheDocument();
  });

  it("shows the URL field when OBS is disabled", () => {
    render(<SourceGeneralForm {...defaultFormProps} isObsEnabled={false} />);
    expect(screen.getByLabelText(/url de reproducción/i)).toBeInTheDocument();
  });

  it("searches and selects a match without changing the save flow", async () => {
    const onMatchChange = vi.fn();
    render(
      <SourceGeneralForm
        {...defaultFormProps}
        matches={[testMatch, secondTestMatch]}
        selectedMatchId="m1"
        onMatchChange={onMatchChange}
        eventLabel={(id) => id === "m1" ? "Deportes Puerto Montt vs Rangers" : "Colo-Colo vs Universidad de Chile"}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: /partido/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /buscar partido/i }), {
      target: { value: "Colo-Colo" },
    });
    fireEvent.click(await screen.findByText("Colo-Colo vs Universidad de Chile"));

    expect(onMatchChange).toHaveBeenCalledWith("m2");
  });

  it("keeps long selected match names inside the form column", () => {
    render(
      <SourceGeneralForm
        {...defaultFormProps}
        eventLabel={() => "Deportes Puerto Montt vs Deportes Recoleta con un nombre muy largo"}
      />,
    );

    const picker = screen.getByRole("combobox", { name: /partido/i });
    expect(picker).toHaveClass("min-w-0", "overflow-hidden");
    expect(picker.querySelector("span")).toHaveClass("min-w-0", "truncate");
  });

  it("expands the match menu to the left and shows complete team names", async () => {
    render(
      <SourceGeneralForm
        {...defaultFormProps}
        matches={[testMatch, secondTestMatch]}
        eventLabel={(id) => id === "m1" ? "Deportes Puerto Montt vs Rangers" : "Colo-Colo vs Universidad de Chile"}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: /partido/i }));
    const search = screen.getByRole("combobox", { name: /buscar partido/i });
    const content = search.closest("[data-radix-popper-content-wrapper]")?.firstElementChild;
    expect(content).toHaveClass("max-w-[34rem]", "sm:w-[34rem]");
    expect(within(content as HTMLElement).getByText("Deportes Puerto Montt vs Rangers")).toHaveClass("whitespace-normal");
    expect(within(content as HTMLElement).getByText("Colo-Colo vs Universidad de Chile")).toHaveClass("whitespace-normal");
  });

  it("hides the URL field when OBS is enabled", () => {
    render(<SourceGeneralForm {...defaultFormProps} isObsEnabled={true} />);
    expect(screen.queryByLabelText(/url de reproducción/i)).not.toBeInTheDocument();
  });

  it("shows OBS-active note when OBS is enabled", () => {
    render(<SourceGeneralForm {...defaultFormProps} isObsEnabled={true} />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("disables usage/format selects when OBS is enabled", () => {
    render(<SourceGeneralForm {...defaultFormProps} isObsEnabled={true} />);
    // Selects are wrapped in Radix trigger — check aria-disabled
    const triggers = screen.getAllByRole("combobox");
    const disabledOnes = triggers.filter((t) => t.getAttribute("data-disabled") === "" || t.hasAttribute("disabled") || t.getAttribute("aria-disabled") === "true");
    expect(disabledOnes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Crear fuente' button text in idle state", () => {
    render(<SourceGeneralForm {...defaultFormProps} />);
    expect(screen.getByRole("button", { name: /crear fuente/i })).toBeInTheDocument();
  });

  it("shows 'Guardando configuración' text when createState=saving", () => {
    render(<SourceGeneralForm {...defaultFormProps} createState="saving" />);
    expect(screen.getByRole("button", { name: /guardando configuración/i })).toBeInTheDocument();
  });

  it("shows 'Creando entrada' text when createState=provisioning", () => {
    render(<SourceGeneralForm {...defaultFormProps} createState="provisioning" />);
    expect(screen.getByRole("button", { name: /creando entrada/i })).toBeInTheDocument();
  });

  it("shows 'Fuente creada' text when createState=done", () => {
    render(<SourceGeneralForm {...defaultFormProps} createState="done" />);
    expect(screen.getByRole("button", { name: /fuente creada/i })).toBeInTheDocument();
  });

  it("disables button during saving/provisioning", () => {
    render(<SourceGeneralForm {...defaultFormProps} createState="provisioning" />);
    const button = screen.getByRole("button", { name: /creando entrada/i });
    expect(button).toBeDisabled();
  });

  it("calls onSave when button is clicked", () => {
    const onSave = vi.fn();
    render(<SourceGeneralForm {...defaultFormProps} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /crear fuente/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows title validation error when provided", () => {
    render(<SourceGeneralForm {...defaultFormProps} titleError="El nombre es obligatorio." />);
    expect(screen.getByRole("alert")).toHaveTextContent("El nombre es obligatorio.");
  });

  it("shows match validation error when provided", () => {
    render(<SourceGeneralForm {...defaultFormProps} matchError="Selecciona un partido." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un partido.");
  });

  it("shows 'Guardar cambios' when editing", () => {
    render(<SourceGeneralForm {...defaultFormProps} isEditing={true} />);
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it("shows cancel button when editing", () => {
    render(<SourceGeneralForm {...defaultFormProps} isEditing={true} onCancelEdit={noop} />);
    expect(screen.getByRole("button", { name: /cancelar edición/i })).toBeInTheDocument();
  });
});

// ── ObsPublishingOptions tests ─────────────────────────────────────────────────

describe("ObsPublishingOptions", () => {
  const obsProps = {
    obsEnabled: false,
    onObsEnabledChange: noop,
    obsProtocol: "rtmps" as const,
    onObsProtocolChange: noop,
    ingestMode: "configured" as const,
    onIngestModeChange: noop,
    recordingEnabled: false,
    onRecordingEnabledChange: noop,
    lowLatencyEnabled: false,
    onLowLatencyEnabledChange: noop,
  };

  it("renders the toggle when OBS is disabled", () => {
    render(<ObsPublishingOptions {...obsProps} />);
    expect(screen.getByRole("switch", { name: /activar publicación obs/i })).toBeInTheDocument();
  });

  it("shows protocol selector when OBS is enabled", () => {
    render(<ObsPublishingOptions {...obsProps} obsEnabled={true} />);
    expect(screen.getByLabelText(/protocolo de ingestión/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /ruta de la señal obs/i })).toBeInTheDocument();
  });

  it("explains when OBS bypasses Restream", () => {
    render(<ObsPublishingOptions {...obsProps} obsEnabled={true} ingestMode="direct_cloudflare" />);
    expect(screen.getByText(/restream no interviene/i)).toBeInTheDocument();
  });

  it("does not show protocol selector when OBS is disabled", () => {
    render(<ObsPublishingOptions {...obsProps} obsEnabled={false} />);
    expect(screen.queryByLabelText(/protocolo de ingestión/i)).not.toBeInTheDocument();
  });

  it("shows recording and low-latency switches when OBS is enabled", () => {
    render(<ObsPublishingOptions {...obsProps} obsEnabled={true} />);
    expect(screen.getByRole("switch", { name: /grabación automática/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /baja latencia/i })).toBeInTheDocument();
  });

  it("calls onObsEnabledChange when toggle is clicked", () => {
    const onChange = vi.fn();
    render(<ObsPublishingOptions {...obsProps} onObsEnabledChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: /activar publicación obs/i }));
    expect(onChange).toHaveBeenCalledOnce();
  });
});

// ── StreamCredentialsPanel tests ───────────────────────────────────────────────

describe("StreamCredentialsPanel", () => {
  it("renders empty state when source is null", () => {
    render(
      <StreamCredentialsPanel
        source={null} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    expect(screen.getByText(/credenciales de transmisión/i)).toBeInTheDocument();
  });

  it("renders skeleton when isProvisioning is true", () => {
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={true}
      />,
    );
    expect(screen.getByText(/aprovisionando señal/i)).toBeInTheDocument();
  });

  it("renders OBS credentials panel for OBS source", () => {
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    expect(screen.getByLabelText(/servidor obs \(ingest url\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/clave de transmisión/i, { selector: "input" })).toBeInTheDocument();
  });

  it("shows the Cloudflare relay destination for the composite provider", () => {
    render(
      <StreamCredentialsPanel
        source={{ ...obsSource, provider: "restream_cloudflare" }}
        onReveal={asyncNoop}
        onRotate={noop}
        revealedKey="restream-key"
        relayDestination={{
          ingestProtocol: "rtmps",
          ingestUrl: "rtmps://live.cloudflare.com:443/live/",
          streamKey: "cloudflare-key",
        }}
        isRevealing={false}
        isRotating={false}
        isProvisioning={false}
      />,
    );

    expect(screen.getByText("Destino Cloudflare para Restream")).toBeInTheDocument();
    expect(screen.getByLabelText("Servidor RTMPS de Cloudflare")).toHaveValue("rtmps://live.cloudflare.com:443/live/");
    expect(screen.getByLabelText("Clave del destino Cloudflare")).toHaveAttribute("type", "password");
  });

  it("shows masked key with last4 when key not revealed", () => {
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    const keyInput = screen.getByLabelText(/clave de transmisión/i, { selector: "input" }) as HTMLInputElement;
    expect(keyInput.value).toContain("A92F");
    expect(keyInput.type).toBe("password");
  });

  it("shows full key when revealedKey is provided and toggled", async () => {
    const fullKey = "abcdef1234567890A92F";
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={fullKey} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    // Toggle reveal
    const toggleBtn = screen.getByRole("button", { name: /revelar clave/i });
    fireEvent.click(toggleBtn);
    const keyInput = screen.getByLabelText(/clave de transmisión/i, { selector: "input" }) as HTMLInputElement;
    expect(keyInput.type).toBe("text");
    expect(keyInput.value).toBe(fullKey);
  });

  it("shows manual source panel for manual source", () => {
    render(
      <StreamCredentialsPanel
        source={manualSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    expect(screen.getByLabelText(/url de reproducción/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/clave de transmisión/i, { selector: "input" })).not.toBeInTheDocument();
  });

  it("calls onReveal when eye button is clicked and key not yet revealed", async () => {
    const onReveal = vi.fn().mockResolvedValue(undefined);
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={onReveal} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /revelar clave/i }));
    await waitFor(() => expect(onReveal).toHaveBeenCalledOnce());
  });

  it("shows rotate button for OBS source", () => {
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={noop}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    expect(screen.getByRole("button", { name: /rotar clave/i })).toBeInTheDocument();
  });

  it("calls onRotate when rotate button is clicked", () => {
    const onRotate = vi.fn();
    render(
      <StreamCredentialsPanel
        source={obsSource} onReveal={asyncNoop} onRotate={onRotate}
        revealedKey={null} isRevealing={false} isRotating={false} isProvisioning={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /rotar clave/i }));
    expect(onRotate).toHaveBeenCalledOnce();
  });
});

// ── ConfiguredSourcesList tests ────────────────────────────────────────────────

describe("ConfiguredSourcesList", () => {
  const listProps = {
    sources: [obsSource, manualSource],
    eventLabel: (id: string) => `Partido ${id}`,
    onEdit: noop,
    onDelete: noop,
    onRotate: noop,
    onToggleEnabled: noop,
    onSetPrimary: noop,
    onSelect: noop,
  };

  it("renders empty state when no sources", () => {
    render(<ConfiguredSourcesList {...listProps} sources={[]} />);
    expect(screen.getByText(/aún no hay fuentes configuradas/i)).toBeInTheDocument();
  });

  it("renders source cards", () => {
    render(<ConfiguredSourcesList {...listProps} />);
    expect(screen.getByText("OBS Signal HD")).toBeInTheDocument();
    expect(screen.getByText("Manual HLS")).toBeInTheDocument();
  });

  it("calls onSelect when a card is clicked", () => {
    const onSelect = vi.fn();
    render(<ConfiguredSourcesList {...listProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /fuente: obs signal hd/i }));
    expect(onSelect).toHaveBeenCalledWith(obsSource);
  });

  it("marks selected source with aria-pressed=true", () => {
    render(<ConfiguredSourcesList {...listProps} selectedSourceId="src-1" />);
    const selectedCard = screen.getByRole("button", { name: /fuente: obs signal hd/i });
    expect(selectedCard).toHaveAttribute("aria-pressed", "true");
  });

  it("shows stream key last4 for OBS sources", () => {
    render(<ConfiguredSourcesList {...listProps} />);
    expect(screen.getByText(/A92F/)).toBeInTheDocument();
  });
});
