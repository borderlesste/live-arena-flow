import { describe, expect, it } from "vitest";
import { sortNewsByNewest } from "./content.service";
import type { NewsArticle } from "@/types";

function article(id: string, publishedAt: string): NewsArticle {
  return { id, title: id, category: "Resultado", excerpt: id, publishedAt, imageHue: 120 };
}

describe("sortNewsByNewest", () => {
  it("returns newest articles first without mutating the API response", () => {
    const input = [article("old", "2026-07-01T10:00:00.000Z"), article("new", "2026-07-03T10:00:00.000Z")];
    expect(sortNewsByNewest(input).map((item) => item.id)).toEqual(["new", "old"]);
    expect(input.map((item) => item.id)).toEqual(["old", "new"]);
  });
});
