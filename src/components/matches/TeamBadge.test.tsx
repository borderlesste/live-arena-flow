import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamBadge } from "./TeamBadge";

const team = {
  id: "team-1",
  name: "Selección Nacional",
  shortName: "SEL",
  monogram: "SN",
  color: "120 70% 45%",
  badgeUrl: "https://cdn.example.com/team.png",
};

describe("TeamBadge", () => {
  it("uses the exact provider logo URL without appending a size path", () => {
    const { container } = render(<TeamBadge team={team} />);
    expect(container.querySelector("img")).toHaveAttribute("src", team.badgeUrl);
  });

  it("keeps the monogram visible when the remote logo fails", () => {
    const { container } = render(<TeamBadge team={team} />);
    const image = container.querySelector("img")!;
    fireEvent.error(image);
    expect(image).not.toBeVisible();
    expect(screen.getByText("SN")).toBeVisible();
  });
});
