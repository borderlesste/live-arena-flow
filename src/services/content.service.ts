import { publicEnv } from "@/config/env";
import type { Highlight, NewsArticle } from "@/types";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

async function list<T>(path: string): Promise<T[]> {
  const response = await fetch(`${API_BASE}/${path}`);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return response.json();
}

export const listNews = () => list<NewsArticle>("news");
export const listHighlights = () => list<Highlight>("highlights");
