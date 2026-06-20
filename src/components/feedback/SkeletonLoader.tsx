import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function SkeletonLoader({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-2/70",
        className,
      )}
      aria-hidden="true"
    />
  );
}
