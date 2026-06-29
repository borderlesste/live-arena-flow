import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveSourceStatus } from "@/schemas/live-source.schema";

interface StatusBadgeProps {
  status?: LiveSourceStatus;
  className?: string;
}

export function SourceStatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;

  const config: Record<
    NonNullable<StatusBadgeProps["status"]>,
    { label: string; className: string; dotClassName?: string }
  > = {
    provisioning: {
      label: "Preparando",
      className: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/20",
    },
    ready: {
      label: "Esperando señal",
      className: "bg-muted text-muted-foreground hover:bg-muted/80 border-border",
    },
    waiting_signal: {
      label: "Esperando señal",
      className: "bg-info/15 text-info hover:bg-info/20 border-info/20 animate-pulse",
    },
    connecting: {
      label: "Conectando",
      className: "bg-info/15 text-info hover:bg-info/20 border-info/20 animate-pulse",
    },
    reconnecting: {
      label: "Reconectando",
      className: "bg-info/15 text-info hover:bg-info/20 border-info/20 animate-pulse",
    },
    live: {
      label: "En vivo",
      className: "bg-success/15 text-success hover:bg-success/20 border-success/30 font-semibold",
      dotClassName: "bg-success animate-ping",
    },
    disconnected: {
      label: "Desconectado",
      className: "bg-destructive/10 text-destructive/80 hover:bg-destructive/15 border-destructive/10",
    },
    disabled: {
      label: "Deshabilitado",
      className: "bg-muted text-muted-foreground hover:bg-muted/80 border-border opacity-60",
    },
    provision_failed: {
      label: "Error de aprovisionamiento",
      className: "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/20",
    },
    provider_error: {
      label: "Error",
      className: "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/20",
    },
    deletion_pending: {
      label: "Eliminación pendiente",
      className: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/20",
    },
    deletion_failed: {
      label: "Error al eliminar",
      className: "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/20",
    },
    deleted: {
      label: "Eliminado",
      className: "bg-muted text-muted-foreground border-border opacity-60",
    },
  };

  const item = config[status] || { label: status, className: "" };

  return (
    <Badge variant="outline" className={cn("flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium", item.className, className)}>
      {item.dotClassName && (
        <span className="relative flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", item.dotClassName)} />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
      )}
      {item.label}
    </Badge>
  );
}

export function SourceKindBadge({ kind, className }: { kind?: "manual" | "obs"; className?: string }) {
  if (!kind) return null;

  return kind === "obs" ? (
    <Badge className={cn("bg-primary/10 text-primary border-primary/20 hover:bg-primary/15", className)} variant="outline">
      OBS
    </Badge>
  ) : (
    <Badge className={cn("bg-muted text-muted-foreground border-border hover:bg-muted/80", className)} variant="outline">
      Manual
    </Badge>
  );
}

export function PlaybackFormatBadge({ format, className }: { format?: string; className?: string }) {
  if (!format) return null;

  const labels: Record<string, string> = {
    hls: "HLS (.m3u8)",
    obs_hls: "HLS (OBS)",
    mp4: "MP4",
    mp3: "MP3",
    youtube: "YouTube",
    youtube_live: "YT Live",
    embed: "Embed",
    iframe: "Iframe",
  };

  return (
    <Badge className={cn("bg-surface-2 text-foreground font-mono text-[10px] uppercase border-border hover:bg-surface-3", className)} variant="outline">
      {labels[format] || format}
    </Badge>
  );
}
