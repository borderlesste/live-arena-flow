import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "default" | "danger" | "warning";
}

export function EmptyState({ title, description, icon, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/60 p-8 text-center", className)}>
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, description, icon, action, className, tone = "danger" }: StateProps) {
  const toneCls = tone === "warning" ? "border-warning/40 bg-warning/5" : "border-destructive/40 bg-destructive/5";
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center", toneCls, className)} role="alert">
      {icon ? <div className={tone === "warning" ? "text-warning" : "text-destructive"}>{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
