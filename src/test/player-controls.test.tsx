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
  useLiveStream: () => ({ status: "live", retry: vi.fn() }),
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
});
