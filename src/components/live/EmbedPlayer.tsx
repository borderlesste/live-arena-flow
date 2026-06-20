import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink } from "lucide-react";
import { isEmbedAllowed } from "@/schemas/stream.schema";

interface EmbedPlayerProps {
  embedUrl: string;
  title: string;
  requiresConsent?: boolean;
  className?: string;
}

/**
 * Iframe-based embed (YouTube/TikTok/Vimeo whitelisted).
 * - URL is checked against allowlist before render.
 * - sandbox + minimal `allow` flags + strict referrer policy.
 * - Consent gate before loading the iframe when requiresConsent.
 */
export function EmbedPlayer({ embedUrl, title, requiresConsent, className }: EmbedPlayerProps) {
  const allowed = isEmbedAllowed(embedUrl);
  const [accepted, setAccepted] = useState<boolean>(!requiresConsent);

  if (!allowed) {
    return (
      <div className={className + " grid place-items-center bg-surface-2 p-6 text-center text-sm text-muted-foreground"}>
        Origen del embed no autorizado.
      </div>
    );
  }

  if (!accepted) {
    return (
      <div className={className + " grid place-items-center bg-surface-2 p-6"}>
        <div className="max-w-md space-y-4 text-center">
          <Shield className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <div>
            <p className="font-display text-base font-semibold">Esta transmisión es de un tercero</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Al continuar, el proveedor externo puede instalar cookies y recopilar datos según su política.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setAccepted(true)} className="bg-gradient-primary text-primary-foreground">
              Aceptar y ver
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={embedUrl} target="_blank" rel="noopener noreferrer">
                Abrir en origen <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <iframe
      title={title}
      src={embedUrl}
      className={className}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}
