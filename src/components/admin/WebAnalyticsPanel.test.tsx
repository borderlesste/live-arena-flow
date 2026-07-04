import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebAnalyticsPanel } from "./WebAnalyticsPanel";

describe("WebAnalyticsPanel", () => {
  it("muestra agregados, estado de configuración y cambia el período", () => {
    const onPeriodChange = vi.fn();
    render(<WebAnalyticsPanel
      period="week"
      loading={false}
      error={null}
      onPeriodChange={onPeriodChange}
      data={{
        period: "week",
        start: "2026-06-28",
        end: "2026-07-04",
        totals: { visits: 1200, pageViews: 1800, pagesPerVisit: 1.5 },
        previous: { visits: 1000, pageViews: 1500 },
        changePercent: 20,
        series: [],
        lastSyncedAt: "2026-07-04T12:00:00.000Z",
        source: "cloudflare",
        configured: false,
        syncStatus: "not_configured",
      }}
    />);

    expect(screen.getByRole("heading", { name: "Visitas al sitio" })).toBeInTheDocument();
    expect(screen.getByText(new Intl.NumberFormat("es").format(1200))).toBeInTheDocument();
    expect(screen.getByText("Cloudflare Web Analytics pendiente de configuración")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 días" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "30 días" }));
    expect(onPeriodChange).toHaveBeenCalledWith("month");
  });
});
