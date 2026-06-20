import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  className?: string;
  label?: string;
}

export function LiveBadge({ className, label = "EN VIVO" }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-live px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-live-foreground",
        className,
      )}
    >
      <span className="live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
