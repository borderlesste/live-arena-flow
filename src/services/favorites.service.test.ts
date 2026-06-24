// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { listFavoriteMatches, setFavoriteMatch } from "./favorites.service";

afterEach(() => vi.restoreAllMocks());

describe("favorites service with local backend auth", () => {
  it("loads the authenticated user's favorite matches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { externalMatchId: "match-1", createdAt: "2026-06-21T12:00:00.000Z" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(listFavoriteMatches("session-token")).resolves.toEqual([
      { externalMatchId: "match-1", createdAt: "2026-06-21T12:00:00.000Z" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/matches", { headers: { Authorization: "Bearer session-token" } });
  });

  it.each([
    [true, "PUT"],
    [false, "DELETE"],
  ])("persists favorite=%s with %s", async (favorite, method) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ favorite }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await setFavoriteMatch("session-token", "provider/match 1", favorite as boolean);
    expect(fetchMock).toHaveBeenCalledWith("/api/favorites/matches/provider%2Fmatch%201", {
      method,
      headers: { Authorization: "Bearer session-token" },
    });
  });
});
