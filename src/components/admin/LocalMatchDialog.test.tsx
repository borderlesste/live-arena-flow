import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalMatchDialog } from "./LocalMatchDialog";

const createLocalMatchMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/local-matches.service", () => ({ createLocalMatch: createLocalMatchMock }));

const createdEvent = {
  id: "local-00000000-0000-4000-8000-000000000001",
  startsAt: "2026-07-10T20:00:00.000Z",
  sport: "Football" as const,
  competition: { id: "local-competition", name: "Liga comunitaria", region: "República Dominicana" },
  homeTeam: { id: "local-home", name: "Atlético Norte" },
  awayTeam: { id: "local-away", name: "Deportivo Sur" },
  homeScore: 0,
  awayScore: 0,
  status: "scheduled" as const,
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Competición"), { target: { value: "Liga comunitaria" } });
  fireEvent.change(screen.getByLabelText("Equipo local"), { target: { value: "Atlético Norte" } });
  fireEvent.change(screen.getByLabelText("Equipo visitante"), { target: { value: "Deportivo Sur" } });
}

describe("LocalMatchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a local match and returns it to the streams page", async () => {
    createLocalMatchMock.mockResolvedValueOnce(createdEvent);
    const onCreated = vi.fn();
    render(<LocalMatchDialog token="session-token" onCreated={onCreated} />);

    fireEvent.click(screen.getByRole("button", { name: "Crear partido local" }));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Crear partido" }));

    await waitFor(() => expect(createLocalMatchMock).toHaveBeenCalledOnce());
    expect(createLocalMatchMock).toHaveBeenCalledWith(expect.objectContaining({
      competitionName: "Liga comunitaria",
      homeTeamName: "Atlético Norte",
      awayTeamName: "Deportivo Sur",
    }), "session-token");
    expect(onCreated).toHaveBeenCalledWith(createdEvent);
  });

  it("does not submit when both teams are equal", async () => {
    render(<LocalMatchDialog token="session-token" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear partido local" }));
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Equipo visitante"), { target: { value: "ATLÉTICO NORTE" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear partido" }));

    expect(await screen.findByText("Los equipos deben ser diferentes")).toBeVisible();
    expect(createLocalMatchMock).not.toHaveBeenCalled();
  });
});
