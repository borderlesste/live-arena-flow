import { cn } from "@/lib/utils";

interface AdvertisementSlotProps {
  variant?: "banner" | "card" | "inline";
  label?: string;
  className?: string;
}

export function AdvertisementSlot({ variant = "banner", label = "Contenido patrocinado", className }: AdvertisementSlotProps) {
  const heights = {
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
