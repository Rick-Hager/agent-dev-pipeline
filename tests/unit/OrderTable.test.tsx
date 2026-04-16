import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { OrderTable } from "@/components/OrderTable";

const fakeOrders = [
  {
    id: "order-1",
    orderNumber: 42,
    customerName: "Maria Silva",
    status: "PREPARING",
    totalInCents: 4800,
    createdAt: "2026-04-16T10:00:00.000Z",
    items: [
      { id: "item-1", name: "X-Burguer", priceInCents: 2000, quantity: 2 },
      { id: "item-2", name: "Fritas", priceInCents: 800, quantity: 1 },
    ],
  },
  {
    id: "order-2",
    orderNumber: 43,
    customerName: "João Santos",
    status: "READY",
    totalInCents: 1500,
    createdAt: "2026-04-16T11:00:00.000Z",
    items: [{ id: "item-3", name: "Suco", priceInCents: 1500, quantity: 1 }],
  },
];

describe("OrderTable", () => {
  it("renders table headers", () => {
    render(<OrderTable orders={fakeOrders} />);
    expect(screen.getByText(/#Pedido|#Order|Pedido/i)).toBeInTheDocument();
    expect(screen.getByText(/cliente|customer/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
  });

  it("renders order rows with correct order numbers", () => {
    render(<OrderTable orders={fakeOrders} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("renders customer names", () => {
    render(<OrderTable orders={fakeOrders} />);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("João Santos")).toBeInTheDocument();
  });

  it("formats total in cents to R$ format", () => {
    render(<OrderTable orders={fakeOrders} />);
    expect(screen.getByText("R$ 48.00")).toBeInTheDocument();
    expect(screen.getByText("R$ 15.00")).toBeInTheDocument();
  });

  it("renders items summary as comma-separated name x quantity", () => {
    render(<OrderTable orders={fakeOrders} />);
    expect(screen.getByText("X-Burguer x2, Fritas x1")).toBeInTheDocument();
    expect(screen.getByText("Suco x1")).toBeInTheDocument();
  });

  it("renders status badge with correct color for PREPARING", () => {
    render(<OrderTable orders={fakeOrders} />);
    const badge = screen.getByText("PREPARING");
    expect(badge).toHaveClass("bg-orange-100");
    expect(badge).toHaveClass("text-orange-800");
  });

  it("renders status badge with correct color for READY", () => {
    render(<OrderTable orders={fakeOrders} />);
    const badge = screen.getByText("READY");
    expect(badge).toHaveClass("bg-green-100");
    expect(badge).toHaveClass("text-green-800");
  });

  it("renders status badge with correct color for CREATED", () => {
    render(
      <OrderTable
        orders={[{ ...fakeOrders[0], status: "CREATED" }]}
      />
    );
    const badge = screen.getByText("CREATED");
    expect(badge).toHaveClass("bg-gray-100");
    expect(badge).toHaveClass("text-gray-800");
  });

  it("renders status badge with correct color for PAYMENT_PENDING", () => {
    render(
      <OrderTable
        orders={[{ ...fakeOrders[0], status: "PAYMENT_PENDING" }]}
      />
    );
    const badge = screen.getByText("PAYMENT_PENDING");
    expect(badge).toHaveClass("bg-yellow-100");
    expect(badge).toHaveClass("text-yellow-800");
  });

  it("renders status badge with correct color for PAYMENT_APPROVED", () => {
    render(
      <OrderTable
        orders={[{ ...fakeOrders[0], status: "PAYMENT_APPROVED" }]}
      />
    );
    const badge = screen.getByText("PAYMENT_APPROVED");
    expect(badge).toHaveClass("bg-blue-100");
    expect(badge).toHaveClass("text-blue-800");
  });

  it("renders status badge with correct color for PICKED_UP", () => {
    render(
      <OrderTable
        orders={[{ ...fakeOrders[0], status: "PICKED_UP" }]}
      />
    );
    const badge = screen.getByText("PICKED_UP");
    expect(badge).toHaveClass("bg-emerald-100");
    expect(badge).toHaveClass("text-emerald-800");
  });

  it("renders status badge with correct color for CANCELLED", () => {
    render(
      <OrderTable
        orders={[{ ...fakeOrders[0], status: "CANCELLED" }]}
      />
    );
    const badge = screen.getByText("CANCELLED");
    expect(badge).toHaveClass("bg-red-100");
    expect(badge).toHaveClass("text-red-800");
  });

  it("clicking a row expands to show full order details", () => {
    render(<OrderTable orders={fakeOrders} />);
    // Detail row not visible before click
    expect(document.querySelector('[data-testid="order-detail-row"]')).toBeNull();
    // Click the first row
    const row = screen.getByText("42").closest("tr")!;
    fireEvent.click(row);
    // After clicking, expanded detail row should be visible
    expect(document.querySelector('[data-testid="order-detail-row"]')).not.toBeNull();
  });

  it("clicking a row again collapses it", () => {
    render(<OrderTable orders={fakeOrders} />);
    const row = screen.getByText("42").closest("tr")!;
    fireEvent.click(row);
    fireEvent.click(row);
    // Expanded detail row should be gone - verify item detail not shown in expansion
    // The expanded section with pricing details should be collapsed
    const expandedRows = document.querySelectorAll('[data-testid="order-detail-row"]');
    expect(expandedRows.length).toBe(0);
  });

  it("shows 'Nenhum pedido encontrado' when orders array is empty", () => {
    render(<OrderTable orders={[]} />);
    expect(screen.getByText("Nenhum pedido encontrado")).toBeInTheDocument();
  });
});
