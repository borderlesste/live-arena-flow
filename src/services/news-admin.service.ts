import { publicEnv } from "@/config/env";
import type { NewsArticle } from "@/types";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(body?.error ?? `Error ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function listAdminNews(token: string): Promise<NewsArticle[]> {
  return fetch(`${API_BASE}/admin/news`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<NewsArticle[]>);
}

export function saveNewsArticle(article: NewsArticle, token: string): Promise<NewsArticle[]> {
  return fetch(`${API_BASE}/admin/news/${encodeURIComponent(article.id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(article),
  }).then(parseResponse<NewsArticle[]>);
}

export function deleteNewsArticle(id: string, token: string): Promise<NewsArticle[]> {
  return fetch(`${API_BASE}/admin/news/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(parseResponse<NewsArticle[]>);
}
