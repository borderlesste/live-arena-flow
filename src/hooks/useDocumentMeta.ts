import { useEffect } from "react";

interface SeoMeta {
  title: string;
  description?: string;
}

export function useDocumentMeta({ title, description }: SeoMeta): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} · Luis Romero Fútbol`;
    let metaDesc: HTMLMetaElement | null = null;
    let prevDesc: string | null = null;
    if (description) {
      metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        prevDesc = metaDesc.getAttribute("content");
        metaDesc.setAttribute("content", description);
      }
    }
    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== null) metaDesc.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}
