import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaMatchCard } from "./AgendaMatchCard";
import type { Competition, Match, Team } from "@/types";

const homeTeam: Team = { id: "home", name: "Club Atlético Norte", shortName: "Norte", monogram: "CN", color: "90 70% 40%" };
const awayTeam: Team = { id: "away", name: "Deportivo del Sur", shortName: "Sur", monogram: "DS", color: "210 70% 45%" };
const competition: Competition = {
  id: "competition",
  name: "Liga Nacional",
  region: "República Dominicana",
  sport: "football",
  monogram: "LN",
  color: "90 70% 40%",
  activeMatches: 0,
};
const match: Match = {
  id: "match-1",
  sport: "football",
  competitionId: competition.id,
  homeTeamId: homeTeam.id,
  awayTeamId: awayTeam.id,
  homeScore: 0,
  awayScore: 0,
  status: "scheduled",
  startsAt: "2026-07-10T20:00:00.000Z",
  venue: "Estadio Nacional",
  streams: [],
};

describe("AgendaMatchCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows both teams and links to the match detail", () => {
    render(
      <MemoryRouter>
        <AgendaMatchCard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Liga Nacional")).toBeVisible();
    expect(screen.getByText("Club Atlético Norte")).toBeVisible();
    expect(screen.getByText("Deportivo del Sur")).toBeVisible();
    expect(screen.queryByText("Horario por confirmar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver partido Club Atlético Norte vs Deportivo del Sur" })).toHaveAttribute("href", "/match/match-1");
  });

  it("does not show a negative countdown for stale scheduled matches", () => {
    render(
      <MemoryRouter>
        <AgendaMatchCard match={{ ...match, startsAt: "2020-01-01T20:00:00.000Z" }} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Horario por confirmar")).toBeVisible();
  });
});
