import { useEffect, useRef, useState } from "react";
import type { StreamSource, StreamStatus } from "@/types";
import { pickAdapter } from "@/services/streaming.service";

export type DemoState =
  | "auto"
  | "active"
  | "offline"
  | "error"
  | "reconnecting"
  | "blocked"
  | "skeleton";

export interface UseLiveStreamState {
  status: StreamStatus;
  adapter: ReturnType<typeof pickAdapter>;
  errorCode?: string;
  retry: () => void;
}

export function useLiveStream(source: StreamSource | undefined, demo: DemoState): UseLiveStreamState {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const retryRef = useRef(0);

  const adapter = source ? pickAdapter(source) : "unsupported";

  useEffect(() => {
    if (demo === "skeleton") { setStatus("loading"); return; }
    if (demo === "offline") { setStatus("offline"); return; }
    if (demo === "error") { setStatus("error"); return; }
    if (demo === "blocked") { setStatus("blocked"); return; }
    if (demo === "reconnecting") { setStatus("buffering"); return; }

    if (!source) { setStatus("offline"); return; }
    if (adapter === "unsupported") { setStatus("blocked"); return; }
    setStatus("loading");
  }, [source, demo, adapter, retryRef.current]);

  return {
    status,
    adapter,
    errorCode: status === "error" ? "ARN-STR-4012" : undefined,
    retry: () => {
      retryRef.current += 1;
      setStatus("loading");
    },
  };
}
