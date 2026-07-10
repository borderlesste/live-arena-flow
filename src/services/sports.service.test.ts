import { afterEach, describe, expect, it, vi } from "vitest";
import { getEventsByRange } from "@/services/sports.service";

afterEach(() => vi.restoreAllMocks());

describe("sports service ranges", () => {
  it("requests the complete inclusive tournament range through one backend call", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ provider: "test", events: [] }));

    await expect(getEventsByRange("2026-06-11", "2026-07-19")).resolves.toEqual([]);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/sports/events");
    expect(Object.fromEntries(url.searchParams)).toEqual({ start: "2026-06-11", end: "2026-07-19" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
