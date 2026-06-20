import type { ReactNode } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

interface LegalLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function LegalLayout({ title, description, children }: LegalLayoutProps) {
  useDocumentMeta({ title, description });
  return (
    <section className="container mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es")}</p>
      <div className="prose prose-invert mt-6 max-w-none prose-headings:font-display prose-a:text-primary">
        {children}
      </div>
    </section>
  );
}
