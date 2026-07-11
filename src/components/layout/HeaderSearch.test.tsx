import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HeaderSearch } from "./HeaderSearch";

vi.mock("@/hooks/useSportsData", () => ({
  useSportsWindow: () => ({
    isLoading: false,
    bundle: {
      matches: [{
        id: "sportsrc-civ-norway",
        sport: "football",
        competitionId: "world",
        homeTeamId: "civ",
        awayTeamId: "norway",
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
        startsAt: "2026-06-30T18:00:00.000Z",
        venue: "Arena",
        streams: [],
      }],
      teams: [
        { id: "civ", name: "Côte d'Ivoire", shortName: "CIV", monogram: "CI", color: "20 70% 50%" },
        { id: "norway", name: "Norway", shortName: "NOR", monogram: "NO", color: "200 70% 50%" },
      ],
      competitions: [{ id: "world", name: "World Championship", region: "World", sport: "football", monogram: "WC", color: "10 70% 50%", activeMatches: 0, totalMatches: 1 }],
    },
  }),
  useSportsSearchData: () => ({
    isLoading: false,
    bundle: {
      matches: [{
        id: "sportsrc-mexico-haiti",
        sport: "football",
        competitionId: "world",
        homeTeamId: "mexico",
        awayTeamId: "haiti",
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
        startsAt: "2026-06-18T18:00:00.000Z",
        venue: "Estadio Mundialista",
        streams: [],
      }],
      teams: [
        { id: "mexico", name: "México", shortName: "MEX", monogram: "ME", color: "20 70% 50%" },
        { id: "haiti", name: "Haití", shortName: "HAI", monogram: "HA", color: "200 70% 50%" },
      ],
      competitions: [{ id: "world", name: "World Championship", region: "World", sport: "football", monogram: "WC", color: "10 70% 50%", activeMatches: 0, totalMatches: 1 }],
    },
  }),
}));

describe("HeaderSearch", () => {
  it("muestra sugerencias por equipo y enlaza al partido", async () => {
    render(<MemoryRouter><HeaderSearch /></MemoryRouter>);
    const input = screen.getByRole("searchbox", { name: "Buscar partidos" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Norway" } });

    const link = await screen.findByRole("link", { name: /Côte d'Ivoire vs Norway/i });
    expect(link).toHaveAttribute("href", "/match/sportsrc-civ-norway");
  });

  it("muestra un estado vacío útil", async () => {
    render(<MemoryRouter><HeaderSearch /></MemoryRouter>);
    const input = screen.getByRole("searchbox", { name: "Buscar partidos" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Barcelona" } });

    expect(await screen.findByText(/No hay coincidencias/i)).toBeInTheDocument();
  });

  it.each(["Mexico", "México", "Haiti", "Haití"])("encuentra selecciones del Mundial con %s", async (query) => {
    render(<MemoryRouter><HeaderSearch /></MemoryRouter>);
    const input = screen.getByRole("searchbox", { name: "Buscar partidos" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });

    expect(await screen.findByRole("link", { name: /México vs Haití/i })).toHaveAttribute(
      "href",
      "/match/sportsrc-mexico-haiti",
    );
  });
});
