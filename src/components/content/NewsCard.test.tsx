import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewsCard } from "./NewsCard";
import type { NewsArticle } from "@/types";

const sponsoredArticle: NewsArticle = {
  id: "article-1",
  title: "Final de campeonato",
  category: "Resultado",
  excerpt: "Todos los detalles del partido.",
  body: "Contenido completo",
  publishedAt: "2026-07-03T10:00:00.000Z",
  imageHue: 90,
  isSponsored: true,
  sponsorName: "Marca Ejemplo",
};

describe("NewsCard", () => {
  it("discloses sponsorship and opens the article from Leer más", () => {
    const onRead = vi.fn();
    render(<NewsCard article={sponsoredArticle} onRead={onRead} />);
    expect(screen.getByText("Contenido patrocinado")).toBeVisible();
    expect(screen.getByText("Presentado por Marca Ejemplo")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /leer más/i }));
    expect(onRead).toHaveBeenCalledWith(sponsoredArticle);
  });
});
