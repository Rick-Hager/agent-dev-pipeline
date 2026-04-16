import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { OrderCard } from "@/components/OrderCard";

const baseOrder = {
  id: "order-1",
  orderNumber: 42,
  customerName: "João Silva",
  status: "PAYMENT_APPROVED" as const,
  createdAt: new Date().toISOString(),
  items: [
    { id: "item-1", name: "Burger", quantity: 2, priceInCents: 1500 },
    { id: "item-2", name: "Fries", quantity: 1, priceInCents: 800 },
  ],
};

describe("OrderCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders order number prominently", () => {
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("renders customer name", () => {
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByText("João Silva")).toBeInTheDocument();
  });

  it("renders item list with quantities", () => {
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByText("2x Burger")).toBeInTheDocument();
    expect(screen.getByText("1x Fries")).toBeInTheDocument();
  });

  it("shows 'Iniciar' button for PAYMENT_APPROVED status", () => {
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeInTheDocument();
  });

  it("shows 'Pronto' button for PREPARING status", () => {
    const order = { ...baseOrder, status: "PREPARING" as const };
    render(
      <OrderCard order={order} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Pronto" })).toBeInTheDocument();
  });

  it("shows 'Entregar' button for READY status", () => {
    const order = { ...baseOrder, status: "READY" as const };
    render(
      <OrderCard order={order} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Entregar" })).toBeInTheDocument();
  });

  it("calls onStatusChange after clicking the action button (PAYMENT_APPROVED)", async () => {
    const onStatusChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "order-1", status: "PREPARING" }),
    });
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={onStatusChange} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    });
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  it("calls fetch with correct URL and payload when clicking Iniciar", async () => {
    const onStatusChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "order-1", status: "PREPARING" }),
    });
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={onStatusChange} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/restaurants/test-restaurant/orders/order-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PREPARING" }),
      })
    );
  });

  it("calls fetch with READY status when clicking Pronto", async () => {
    const order = { ...baseOrder, status: "PREPARING" as const };
    const onStatusChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "order-1", status: "READY" }),
    });
    render(
      <OrderCard order={order} slug="test-restaurant" onStatusChange={onStatusChange} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/restaurants/test-restaurant/orders/order-1",
      expect.objectContaining({
        body: JSON.stringify({ status: "READY" }),
      })
    );
  });

  it("calls fetch with PICKED_UP status when clicking Entregar", async () => {
    const order = { ...baseOrder, status: "READY" as const };
    const onStatusChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "order-1", status: "PICKED_UP" }),
    });
    render(
      <OrderCard order={order} slug="test-restaurant" onStatusChange={onStatusChange} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/restaurants/test-restaurant/orders/order-1",
      expect.objectContaining({
        body: JSON.stringify({ status: "PICKED_UP" }),
      })
    );
  });

  it("shows time elapsed as 'Agora' for very recent orders", () => {
    render(
      <OrderCard order={baseOrder} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByText("Agora")).toBeInTheDocument();
  });

  it("shows time elapsed in minutes for older orders", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: fiveMinutesAgo };
    render(
      <OrderCard order={order} slug="test-restaurant" onStatusChange={vi.fn()} />
    );
    expect(screen.getByText("5 min atrás")).toBeInTheDocument();
  });
});
