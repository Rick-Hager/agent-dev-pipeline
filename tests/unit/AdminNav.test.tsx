import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock LogoutButton since it uses fetch/window
vi.mock("@/components/LogoutButton", () => ({
  default: () => <button>Logout</button>,
}));

import { AdminNav } from "@/components/admin/AdminNav";

describe("AdminNav", () => {
  it("renders restaurant name", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    expect(screen.getByText("Burger Place")).toBeInTheDocument();
  });

  it("renders Dashboard link with correct href", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link).toHaveAttribute("href", "/backoffice/dashboard");
  });

  it("renders Gerenciar Cardápio link with correct href", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    const link = screen.getByRole("link", { name: /gerenciar cardápio/i });
    expect(link).toHaveAttribute("href", "/backoffice/menu");
  });

  it("renders Ver Pedidos link with correct href", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    const link = screen.getByRole("link", { name: /ver pedidos/i });
    expect(link).toHaveAttribute("href", "/backoffice/orders");
  });

  it("renders Configurações link with correct href", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    const link = screen.getByRole("link", { name: /configurações/i });
    expect(link).toHaveAttribute("href", "/backoffice/settings");
  });

  it("renders Abrir KDS link with slug-based href", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    const link = screen.getByRole("link", { name: /abrir kds/i });
    expect(link).toHaveAttribute("href", "/burger-place/kds");
  });

  it("renders LogoutButton", () => {
    render(
      <AdminNav restaurantName="Burger Place" restaurantSlug="burger-place" />
    );
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
