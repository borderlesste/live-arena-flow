import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Full-bleed (no horizontal padding) when true. */
  bleed?: boolean;
}

export function PageContainer({ children, className, bleed }: PageContainerProps) {
  return (
    <div className={cn(bleed ? "w-full" : "container mx-auto px-4 md:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
