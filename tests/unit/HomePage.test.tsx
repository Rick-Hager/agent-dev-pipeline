import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders MenuApp as heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "MenuApp" })).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<HomePage />);
    expect(screen.getByText("Cardápio digital para restaurantes")).toBeInTheDocument();
  });

  it("renders a link to /admin/login with text Entrar", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: "Entrar" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/login");
  });
});
