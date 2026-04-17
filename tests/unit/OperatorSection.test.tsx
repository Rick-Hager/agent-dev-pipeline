import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorSection } from "@/components/landing/OperatorSection";

describe("OperatorSection", () => {
  it("renders heading 'Para o operador'", () => {
    render(<OperatorSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Para o operador/i })
    ).toBeInTheDocument();
  });

  it("mentions KDS em tempo real", () => {
    render(<OperatorSection />);
    expect(screen.getByText(/KDS em tempo real/i)).toBeInTheDocument();
  });

  it("mentions gestão simples de cardápio", () => {
    render(<OperatorSection />);
    expect(screen.getByText(/gestão simples/i)).toBeInTheDocument();
  });

  it("mentions produtividade", () => {
    render(<OperatorSection />);
    expect(screen.getByText(/produtividade/i)).toBeInTheDocument();
  });
});
