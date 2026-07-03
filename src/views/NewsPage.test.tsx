import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsPage from "./NewsPage";
import type { NewsArticle } from "@/types";

const mockedUseNewsData = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useNewsData", () => ({ useNewsData: mockedUseNewsData }));
vi.mock("@/hooks/useDocumentMeta", () => ({ useDocumentMeta: vi.fn() }));

const news: NewsArticle[] = [
  {
    id: "news-1",
    title: "Análisis desde São Paulo",
    category: "Análisis",
    excerpt: "Claves del partido internacional.",
    body: "Lectura táctica completa.",
    publishedAt: "2026-07-03T12:00:00.000Z",
    imageHue: 80,
  },
  {
    id: "news-2",
    title: "Mercado de fichajes",
    category: "Actualidad",
    excerpt: "Los movimientos más recientes.",
    body: "Altas y bajas confirmadas.",
    publishedAt: "2026-07-02T12:00:00.000Z",
    imageHue: 120,
  },
];

describe("NewsPage", () => {
  beforeEach(() => {
    mockedUseNewsData.mockReturnValue({ news, isLoading: false, isError: false, refetch: vi.fn() });
  });

  it("filters news from the header search and ignores accents", () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>);

    const search = screen.getByRole("searchbox", { name: "Buscar noticias" });
    fireEvent.change(search, { target: { value: "sao paulo" } });

    expect(screen.getByText("Análisis desde São Paulo")).toBeVisible();
    expect(screen.queryByText("Mercado de fichajes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByText("Mercado de fichajes")).toBeVisible();
  });

  it("shows a useful empty state when no article matches", () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar noticias" }), { target: { value: "baloncesto" } });

    expect(screen.getByText("No encontramos noticias")).toBeVisible();
    expect(screen.getByText(/no hay resultados para “baloncesto”/i)).toBeVisible();
  });
});
