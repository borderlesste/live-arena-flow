import { createRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LivePlayer } from "@/components/live/LivePlayer";
import { PlayerControls } from "@/components/live/PlayerControls";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/useLiveStream", () => ({
  useLiveStream: (source?: { isPlayable?: boolean }) => ({
    status: source?.isPlayable === false ? "offline" : "live",
    retry: vi.fn(),
  }),
}));

vi.mock("@/services/streaming.service", () => ({
  pickAdapter: () => "hls",
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

afterEach(() => {
  vi.restoreAllMocks();
});

function renderControls(mediaControlsEnabled: boolean) {
  const containerRef = createRef<HTMLDivElement>();
  render(
    <TooltipProvider>
      <div ref={containerRef}>
        <video />
      </div>
      <PlayerControls containerRef={containerRef} mediaControlsEnabled={mediaControlsEnabled} />
    </TooltipProvider>,
  );
  return containerRef;
}

describe("PlayerControls", () => {
  it("disables media actions when no playable source exists", () => {
    renderControls(false);

    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Silenciar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Picture in picture" })).toBeDisabled();
  });

  it("reports an unavailable stream instead of a browser block", async () => {
    const containerRef = renderControls(true);
    const video = containerRef.current?.querySelector("video");
    if (!video) throw new Error("Expected a video element");
    Object.defineProperty(video, "paused", { configurable: true, value: true });
    vi.spyOn(video, "play").mockRejectedValueOnce(
      new DOMException("The element has no supported sources", "NotSupportedError"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("La transmisión todavía no está disponible"));
    expect(toast.error).not.toHaveBeenCalledWith("El navegador bloqueó la reproducción");
  });

  it("synchronizes play and pause labels with the media element", () => {
    const containerRef = renderControls(true);
    const video = containerRef.current?.querySelector("video");
    if (!video) throw new Error("Expected a video element");

    Object.defineProperty(video, "paused", { configurable: true, value: false });
    act(() => video.dispatchEvent(new Event("play")));
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();

    Object.defineProperty(video, "paused", { configurable: true, value: true });
    act(() => video.dispatchEvent(new Event("pause")));
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeInTheDocument();
  });

  it("connects mute, fullscreen, picture-in-picture and share to browser APIs", async () => {
    const containerRef = renderControls(true);
    const container = containerRef.current;
    const video = container?.querySelector("video") as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<unknown>;
    } | null;
    if (!container || !video) throw new Error("Expected player elements");
    Object.defineProperty(video, "muted", { configurable: true, value: false, writable: true });
    Object.defineProperty(container, "requestFullscreen", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
    video.requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    fireEvent.click(screen.getByRole("button", { name: "Silenciar" }));
    expect(video.muted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
    expect(container.requestFullscreen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Picture in picture" }));
    expect(video.requestPictureInPicture).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: window.location.href })));
  });

  it("does not report a share error when the user cancels the native sheet", async () => {
    renderControls(true);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    });

    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));

    await act(async () => Promise.resolve());
    expect(toast.error).not.toHaveBeenCalledWith("No se pudo compartir");
  });

  it("shows elapsed time from real media events", () => {
    const containerRef = renderControls(true);
    const video = containerRef.current?.querySelector("video");
    if (!video) throw new Error("Expected a video element");

    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 30, writable: true });
    act(() => video.dispatchEvent(new Event("loadedmetadata")));
    act(() => video.dispatchEvent(new Event("timeupdate")));

    expect(screen.getByText("0:30 / 2:00")).toBeInTheDocument();
  });

  it("shows a cover overlay before playback and hides it after the user presses play", async () => {
    const match = {
      id: "match-1",
      status: "live",
      streams: [{
        id: "stream-1",
        title: "Principal",
        type: "hls",
        url: "https://example.com/stream.m3u8",
        coverImageUrl: "https://example.com/cover.jpg",
      }],
    };

    render(
      <TooltipProvider>
        <LivePlayer
          match={match as never}
          homeTeam={{ id: "home", name: "Local", shortName: "LOC" } as never}
          awayTeam={{ id: "away", name: "Visitante", shortName: "VIS" } as never}
          competitionName="Liga"
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: /reproducir transmisión/i })).toBeInTheDocument();

    const video = document.querySelector("video");
    if (!video) throw new Error("Expected a video element");
    Object.defineProperty(video, "play", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });

    fireEvent.click(screen.getByRole("button", { name: /reproducir transmisión/i }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /reproducir transmisión/i })).not.toBeInTheDocument());
  });

  it("shows the cover without a fake play action while an OBS signal is pending", () => {
    const match = {
      id: "match-pending", status: "live",
      streams: [{
        id: "stream-pending", title: "OBS pendiente", type: "obs_hls",
        url: "https://example.com/pending.m3u8", coverImageUrl: "https://example.com/poster.jpg",
        isPlayable: false,
      }],
    };
    render(
      <TooltipProvider>
        <LivePlayer match={match as never} homeTeam={{ id: "h", name: "Local" } as never} awayTeam={{ id: "a", name: "Visita" } as never} competitionName="Liga" />
      </TooltipProvider>,
    );

    expect(screen.getByAltText("Portada de OBS pendiente")).toBeInTheDocument();
    expect(screen.getByText("Transmisión pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reproducir transmisión/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });

  it("toggles controls on mobile surface taps and auto-hides them while playing", () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const match = {
      id: "match-touch",
      status: "live",
      streams: [{ id: "stream-touch", title: "Principal", type: "hls", url: "https://example.com/live.m3u8" }],
    };

    render(
      <TooltipProvider>
        <LivePlayer
          match={match as never}
          homeTeam={{ id: "home", name: "Local", shortName: "LOC" } as never}
          awayTeam={{ id: "away", name: "Visitante", shortName: "VIS" } as never}
          competitionName="Liga"
        />
      </TooltipProvider>,
    );

    const player = screen.getByTestId("live-player");
    const controls = screen.getByTestId("player-controls");
    const video = player.querySelector("video");
    if (!video) throw new Error("Expected a video element");
    Object.defineProperty(video, "paused", { configurable: true, value: false });
    act(() => video.dispatchEvent(new Event("playing")));

    fireEvent.pointerDown(player, { pointerType: "touch" });
    expect(controls).toHaveClass("opacity-0", "pointer-events-none");

    fireEvent.pointerDown(player, { pointerType: "touch" });
    expect(controls).not.toHaveClass("opacity-0");

    act(() => vi.advanceTimersByTime(3000));
    expect(controls).toHaveClass("opacity-0", "pointer-events-none");
    vi.useRealTimers();
  });

  it("keeps controls visible when a mobile control itself is tapped", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(pointer: coarse)", media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const match = {
      id: "match-control-touch", status: "live",
      streams: [{ id: "stream-control", title: "Principal", type: "hls", url: "https://example.com/live.m3u8" }],
    };
    render(
      <TooltipProvider>
        <LivePlayer match={match as never} homeTeam={{ id: "h", name: "Local" } as never} awayTeam={{ id: "a", name: "Visita" } as never} competitionName="Liga" />
      </TooltipProvider>,
    );
    const controls = screen.getByTestId("player-controls");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Compartir" }), { pointerType: "touch" });
    expect(controls).not.toHaveClass("opacity-0");
  });
});
