import { useEffect, useState } from "react";
import type { StreamSource, StreamStatus } from "@/types";
import { pickAdapter } from "@/services/streaming.service";

export interface UseLiveStreamState {
  status: StreamStatus;
  adapter: ReturnType<typeof pickAdapter>;
  errorCode?: string;
  retry: () => void;
}

export function useLiveStream(source: StreamSource | undefined): UseLiveStreamState {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const adapter = source ? pickAdapter(source) : "unsupported";

  useEffect(() => {
    if (!source) { setStatus("offline"); return; }

    if (source.isPlayable === false) {
      setStatus("offline");
      return;
    }

    // OBS source with no playback URL yet — waiting for signal
    if (source.type === "obs_hls" && !source.url) {
      setStatus("offline");
      return;
    }

    if (adapter === "unsupported") { setStatus("blocked"); return; }
    setStatus("live");
  }, [source, adapter]);

  return {
    status,
    adapter,
    errorCode: status === "error" ? "ARN-STR-4012" : undefined,
    retry: () => {
      setStatus(source && adapter !== "unsupported" ? "live" : "offline");
    },
  };
}
