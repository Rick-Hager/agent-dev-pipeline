import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock OrderCard to keep the test focused on page-level behavior
vi.mock("@/components/OrderCard", () => ({
  OrderCard: ({ order }: { order: { orderNumber: number; customerName: string; status: string } }) => (
    <div data-testid={`order-card-${order.orderNumber}`} data-status={order.status}>
      {order.customerName}
    </div>
  ),
}));

// Mock next/navigation useParams
const { useParamsMock } = vi.hoisted(() => {
  const useParamsMock = vi.fn();
  return { useParamsMock };
});

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
}));

import KdsPage from "@/app/[slug]/kds/page";

const fakeOrders = [
  {
    id: "order-1",
    orderNumber: 1,
    customerName: "Alice",
    status: "PAYMENT_APPROVED",
    createdAt: new Date().toISOString(),
    items: [{ id: "item-1", name: "Burger", quantity: 1, priceInCents: 1500 }],
  },
  {
    id: "order-2",
    orderNumber: 2,
    customerName: "Bob",
    status: "PREPARING",
    createdAt: new Date().toISOString(),
    items: [{ id: "item-2", name: "Pizza", quantity: 2, priceInCents: 3000 }],
  },
  {
    id: "order-3",
    orderNumber: 3,
    customerName: "Carol",
    status: "READY",
    createdAt: new Date().toISOString(),
    items: [{ id: "item-3", name: "Salad", quantity: 1, priceInCents: 1200 }],
  },
];

describe("KdsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({ slug: "test-restaurant" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders: fakeOrders }),
    });
  });

  it("renders 3 columns: Novos, Preparando, Prontos", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      expect(screen.getByText("Novos")).toBeInTheDocument();
      expect(screen.getByText("Preparando")).toBeInTheDocument();
      expect(screen.getByText("Prontos")).toBeInTheDocument();
    });
  });

  it("displays PAYMENT_APPROVED orders in Novos column", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      const card = screen.getByTestId("order-card-1");
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-status", "PAYMENT_APPROVED");
    });
  });

  it("displays PREPARING orders in Preparando column", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      const card = screen.getByTestId("order-card-2");
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-status", "PREPARING");
    });
  });

  it("displays READY orders in Prontos column", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      const card = screen.getByTestId("order-card-3");
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-status", "READY");
    });
  });

  it("shows 'Nenhum pedido' in empty columns", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [] }),
    });
    render(<KdsPage />);
    await waitFor(() => {
      const emptyMessages = screen.getAllByText("Nenhum pedido");
      expect(emptyMessages).toHaveLength(3);
    });
  });

  it("shows order count badge in each column header", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      // Novos: 1 order, Preparando: 1 order, Prontos: 1 order
      const badges = screen.getAllByText("1");
      expect(badges).toHaveLength(3);
    });
  });

  it("shows correct badge count when a column has multiple orders", async () => {
    const extraOrder = {
      id: "order-4",
      orderNumber: 4,
      customerName: "Dave",
      status: "PAYMENT_APPROVED",
      createdAt: new Date().toISOString(),
      items: [],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [...fakeOrders, extraOrder] }),
    });
    render(<KdsPage />);
    await waitFor(() => {
      // Novos column should show badge "2"
      expect(screen.getByTestId("badge-novos")).toHaveTextContent("2");
    });
  });

  it("fetches orders from the correct API endpoint", async () => {
    render(<KdsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/restaurants/test-restaurant/kds"
      );
    });
  });
});
