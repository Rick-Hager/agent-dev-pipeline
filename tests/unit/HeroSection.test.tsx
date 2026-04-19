import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "@/components/landing/HeroSection";

describe("HeroSection", () => {
  it("renders the h1 'Cardápio Rápido'", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Cardápio Rápido/i })
    ).toBeInTheDocument();
  });

  it("renders the pricing subheadline emphasizing R$ 1 per order", () => {
    render(<HeroSection />);
    expect(screen.getByText(/R\$\s?1 por pedido/i)).toBeInTheDocument();
    expect(screen.getByText(/sem\s*%/i)).toBeInTheDocument();
  });

  it("renders 'Entrar' link pointing to /backoffice/login", () => {
    render(<HeroSection />);
    const link = screen.getByRole("link", { name: /Entrar/i });
    expect(link).toHaveAttribute("href", "/backoffice/login");
  });

  it("renders 'Quero para minha loja' link pointing to #contato", () => {
    render(<HeroSection />);
    const link = screen.getByRole("link", { name: /Quero para minha loja/i });
    expect(link).toHaveAttribute("href", "#contato");
  });
});
