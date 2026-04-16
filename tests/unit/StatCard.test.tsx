import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { StatCard } from "@/components/admin/StatCard";

describe("StatCard", () => {
  it("renders title", () => {
    render(<StatCard title="Pedidos Hoje" value="42" />);
    expect(screen.getByText("Pedidos Hoje")).toBeInTheDocument();
  });

  it("renders value prominently", () => {
    render(<StatCard title="Receita Hoje" value="R$ 150,00" />);
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <StatCard title="Pedidos Hoje" value="42" description="pedidos confirmados" />
    );
    expect(screen.getByText("pedidos confirmados")).toBeInTheDocument();
  });

  it("does not render description element when not provided", () => {
    render(<StatCard title="Pedidos Hoje" value="42" />);
    expect(screen.queryByTestId("stat-card-description")).not.toBeInTheDocument();
  });
});
