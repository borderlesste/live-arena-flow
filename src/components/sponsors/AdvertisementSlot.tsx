import { cn } from "@/lib/utils";
import type { Sponsor } from "@/types";
import { SponsorLogo, SponsorCarousel } from "./SponsorCarousel";

interface AdvertisementSlotProps {
  /** Sponsors to display. When provided and non-empty, shows real sponsors instead of placeholder. */
  sponsors?: Sponsor[];
  variant?: "banner" | "card" | "inline";
  label?: string;
  className?: string;
}

/**
 * Displays a sponsor banner using real sponsor data when available,
 * or a placeholder when no sponsors are passed / list is empty.
 */
export function AdvertisementSlot({
  sponsors = [],
  variant = "banner",
  label = "Contenido patrocinado",
  className,
}: AdvertisementSlotProps) {
  // ── Real sponsors ──────────────────────────────────────────────────────────
  if (sponsors.length > 0) {
    if (sponsors.length === 1) {
      return (
        <div className={cn("w-full", className)} aria-label={label}>
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/60 text-center">
            {label}
          </p>
          <SponsorLogo sponsor={sponsors[0]} />
        </div>
      );
    }

    return (
      <div className={cn("w-full", className)} aria-label={label}>
        <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/60 text-center">
          {label}
        </p>
        <SponsorCarousel sponsors={sponsors} />
      </div>
    );
  }

  // ── Placeholder ────────────────────────────────────────────────────────────
  const heights: Record<NonNullable<AdvertisementSlotProps["variant"]>, string> = {
    banner: "h-20 md:h-24",
    card: "h-44",
    inline: "h-16",
  };

  return (
    <div
      role="complementary"
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-border bg-gradient-surface",
        heights[variant],
        className,
      )}
    >
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-sm font-semibold text-foreground/80">Tu marca aquí</p>
        </div>
      </div>
    </div>
  );
}
