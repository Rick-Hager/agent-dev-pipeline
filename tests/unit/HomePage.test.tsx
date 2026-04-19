import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage (landing)", () => {
  it("renders the 'Cardápio Rápido' headline as h1", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Cardápio Rápido/i })
    ).toBeInTheDocument();
  });

  it("communicates the pricing value prop of R$ 1 per order with no percentage", () => {
    render(<HomePage />);
    // Pricing wording should be present on the landing (hero or pricing section)
    expect(screen.getAllByText(/R\$\s?1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sem\s*%/i).length).toBeGreaterThan(0);
  });

  it("renders 'Entrar' CTA pointing to /backoffice/login", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /Entrar/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/backoffice/login");
  });

  it("renders 'Quero para minha loja' CTA pointing to #contato", () => {
    render(<HomePage />);
    const links = screen.getAllByRole("link", { name: /Quero para minha loja/i });
    const anchorLink = links.find(
      (el) => el.getAttribute("href") === "#contato"
    );
    expect(anchorLink).toBeDefined();
  });

  it("renders 'Como funciona' section with exactly 3 steps", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 2, name: /Como funciona/i });
    expect(heading).toBeInTheDocument();

    const section = heading.closest("section");
    expect(section).not.toBeNull();
    if (section) {
      const steps = within(section).getAllByTestId("how-it-works-step");
      expect(steps).toHaveLength(3);
    }
  });

  it("mentions QR scan, order+pay, and KDS flow in 'Como funciona'", () => {
    render(<HomePage />);
    expect(screen.getAllByText(/QR/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/KDS/i).length).toBeGreaterThan(0);
  });

  it("renders the 'Para o operador' section heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Para o operador/i })
    ).toBeInTheDocument();
  });

  it("renders the 'Para o consumidor' section heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Para o consumidor/i })
    ).toBeInTheDocument();
  });

  it("renders the 'Preço' section heading and the pricing highlight", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Preço/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Sem mensalidade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fatura no fim do mês/i).length).toBeGreaterThan(0);
  });

  it("renders the 'Contato' section heading with id='contato' anchor", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 2, name: /Contato/i });
    expect(heading).toBeInTheDocument();
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("id")).toBe("contato");
  });

  it("renders a contact mailto link", () => {
    render(<HomePage />);
    const mailto = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href")?.startsWith("mailto:"));
    expect(mailto).toBeDefined();
  });
});
