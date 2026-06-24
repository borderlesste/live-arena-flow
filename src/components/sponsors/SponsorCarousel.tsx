import { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { trackSponsorClick, trackSponsorImpression } from "@/services/sponsors.service";
import type { Sponsor } from "@/types";

interface SponsorCarouselProps { sponsors: Sponsor[] }

function reportTelemetryError(error: unknown) {
  if (process.env.NODE_ENV === "development") console.warn("Sponsor telemetry failed", error);
}

export function SponsorCarousel({ sponsors }: SponsorCarouselProps) {
  const reduced = useReducedMotion();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, dragFree: true, align: "start" });
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!embla || reduced) return;
    function tick() { if (embla && !pausedRef.current && !document.hidden) embla.scrollNext(); }
    timerRef.current = window.setInterval(tick, 3200);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [embla, reduced]);

  return (
    <div className="overflow-hidden" ref={emblaRef} onMouseEnter={() => (pausedRef.current = true)} onMouseLeave={() => (pausedRef.current = false)} onFocus={() => (pausedRef.current = true)} onBlur={() => (pausedRef.current = false)}>
      <ul className="flex gap-3">
        {sponsors.map((sponsor) => <li key={sponsor.id} className="shrink-0"><SponsorLogo sponsor={sponsor} /></li>)}
      </ul>
    </div>
  );
}

export function SponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  const impressionRef = useRef<HTMLDivElement>(null);
  const impressionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const element = impressionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let dwellTimer: number | undefined;
    let recorded = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (recorded) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        dwellTimer ??= window.setTimeout(() => {
          recorded = true;
          void trackSponsorImpression(sponsor.id, impressionIdRef.current, entry.intersectionRatio).catch(reportTelemetryError);
          observer.disconnect();
        }, 1_000);
      } else if (dwellTimer) {
        window.clearTimeout(dwellTimer);
        dwellTimer = undefined;
      }
    }, { threshold: [0.6, 0.8, 1] });
    observer.observe(element);
    return () => { observer.disconnect(); if (dwellTimer) window.clearTimeout(dwellTimer); };
  }, [sponsor.id]);

  const content = (
    <div ref={impressionRef} className="surface-card group flex h-16 min-w-[160px] items-center gap-3 rounded-xl px-4 transition-colors hover:border-primary/40" aria-label={`Patrocinador ${sponsor.name}`}>
      {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={sponsor.altText ?? `Logo de ${sponsor.name}`} loading="lazy" className="h-9 w-14 rounded-md object-contain" /> : <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-md font-display text-xs font-bold text-foreground/80 ring-1 ring-white/10 transition-colors group-hover:text-foreground" style={{ background: `linear-gradient(135deg, hsl(${sponsor.color} / 0.35), hsl(${sponsor.color} / 0.1))` }}>{sponsor.monogram}</span>}
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold">{sponsor.name}</p>
        {sponsor.tagline ? <p className="truncate text-[11px] text-muted-foreground">{sponsor.tagline}</p> : null}
      </div>
    </div>
  );

  return sponsor.url ? <a href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => void trackSponsorClick(sponsor.id).catch(reportTelemetryError)}>{content}</a> : content;
}
