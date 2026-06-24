import { cn } from "@/lib/utils";
import type { Team } from "@/types";

interface TeamBadgeProps {
  team: Team;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap: Record<NonNullable<TeamBadgeProps["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-lg",
};

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold uppercase tracking-wider text-foreground",
        "ring-1 ring-inset ring-white/10 shadow-card",
        sizeMap[size],
        className,
      )}
      style={{
        background: `radial-gradient(circle at 30% 25%, hsl(${team.color} / 0.45), hsl(${team.color} / 0.15) 60%, hsl(215 30% 10%) 100%)`,
      }}
    >
      {team.badgeUrl ? (
        <img src={`${team.badgeUrl}/tiny`} alt="" className="h-[72%] w-[72%] object-contain" loading="lazy" />
      ) : team.monogram}
    </span>
  );
}
