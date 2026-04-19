import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingSection } from "@/components/landing/PricingSection";

describe("PricingSection", () => {
  it("renders heading 'Preço'", () => {
    render(<PricingSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Preço/i })
    ).toBeInTheDocument();
  });

  it("highlights 'R$ 1 por pedido pago'", () => {
    render(<PricingSection />);
    expect(screen.getByText(/R\$\s?1 por pedido pago/i)).toBeInTheDocument();
  });

  it("mentions 'Sem mensalidade'", () => {
    render(<PricingSection />);
    expect(screen.getByText(/Sem mensalidade/i)).toBeInTheDocument();
  });

  it("mentions 'Sem % sobre venda'", () => {
    render(<PricingSection />);
    expect(screen.getByText(/Sem % sobre venda/i)).toBeInTheDocument();
  });

  it("mentions 'Fatura no fim do mês'", () => {
    render(<PricingSection />);
    expect(screen.getByText(/Fatura no fim do mês/i)).toBeInTheDocument();
  });
});
