import { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import type { Sponsor } from "@/types";

interface SponsorCarouselProps {
  sponsors: Sponsor[];
}

export function SponsorCarousel({ sponsors }: SponsorCarouselProps) {
  const reduced = useReducedMotion();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, dragFree: true, align: "start" });
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!embla || reduced) return;
    function tick() {
      if (!embla || pausedRef.current) return;
      embla.scrollNext();
    }
    timerRef.current = window.setInterval(tick, 3200);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [embla, reduced]);

  return (
    <div
      className="overflow-hidden"
      ref={emblaRef}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
    >
      <ul className="flex gap-3">
        {sponsors.map((s) => (
          <li key={s.id} className="shrink-0">
            <SponsorLogo sponsor={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div
      className="surface-card group flex h-16 min-w-[160px] items-center gap-3 rounded-xl px-4 transition-colors hover:border-primary/40"
      aria-label={`Patrocinador ${sponsor.name}`}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-md font-display text-xs font-bold text-foreground/80 ring-1 ring-white/10 transition-colors group-hover:text-foreground"
        style={{ background: `linear-gradient(135deg, hsl(${sponsor.color} / 0.35), hsl(${sponsor.color} / 0.1))` }}
      >
        {sponsor.monogram}
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold">{sponsor.name}</p>
        {sponsor.tagline ? <p className="truncate text-[11px] text-muted-foreground">{sponsor.tagline}</p> : null}
      </div>
    </div>
  );
}
