import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DashboardView,
  computeConversionRate,
  type DashboardStats,
} from "@/components/admin/DashboardView";

const defaultStats: DashboardStats = {
  ordersToday: 7,
  revenueTodayInCents: 12345,
  activeOrders: 2,
  pendingPayments: 3,
  conversionRatePercent: 50,
};

describe("DashboardView", () => {
  it("renders Pagamentos Pendentes card with the given count", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={defaultStats}
        mercadopagoConfigured
      />
    );
    expect(screen.getByText("Pagamentos Pendentes")).toBeInTheDocument();
    // card value for pending payments
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders Taxa de Conversão card with % formatted value", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={{ ...defaultStats, conversionRatePercent: 67.5 }}
        mercadopagoConfigured
      />
    );
    expect(screen.getByText("Taxa de Conversão")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
  });

  it("shows the MercadoPago alert when not configured", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={defaultStats}
        mercadopagoConfigured={false}
      />
    );
    const alert = screen.getByTestId("mercadopago-alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/mercadopago não configurado/i);
  });

  it("does NOT show the MercadoPago alert when configured", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={defaultStats}
        mercadopagoConfigured
      />
    );
    expect(screen.queryByTestId("mercadopago-alert")).not.toBeInTheDocument();
  });

  it('renders "Ver Cardápio" link pointing to /{slug}', () => {
    render(
      <DashboardView
        slug="my-rest"
        stats={defaultStats}
        mercadopagoConfigured
      />
    );
    const link = screen.getByRole("link", { name: /ver cardápio/i });
    expect(link).toHaveAttribute("href", "/my-rest");
  });

  it("renders Pedidos Hoje, Receita Hoje, Pedidos Ativos cards", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={defaultStats}
        mercadopagoConfigured
      />
    );
    expect(screen.getByText("Pedidos Hoje")).toBeInTheDocument();
    expect(screen.getByText("Receita Hoje")).toBeInTheDocument();
    expect(screen.getByText("Pedidos Ativos")).toBeInTheDocument();
  });

  it("renders revenue formatted in BRL (R$)", () => {
    render(
      <DashboardView
        slug="my-slug"
        stats={{ ...defaultStats, revenueTodayInCents: 12345 }}
        mercadopagoConfigured
      />
    );
    // NBSP-tolerant match for "R$ 123,45"
    expect(screen.getByText(/R\$[\s\u00a0]*123,45/)).toBeInTheDocument();
  });
});

describe("computeConversionRate", () => {
  it("returns 0 when there are no orders", () => {
    expect(computeConversionRate(0, 0)).toBe(0);
  });

  it("returns a percentage when total > 0", () => {
    expect(computeConversionRate(1, 2)).toBe(50);
    expect(computeConversionRate(3, 4)).toBe(75);
  });

  it("returns 100 when every order was paid", () => {
    expect(computeConversionRate(5, 5)).toBe(100);
  });
});
