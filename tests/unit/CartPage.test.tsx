import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const { useCartMock, useParamsMock } = vi.hoisted(() => ({
  useCartMock: vi.fn(),
  useParamsMock: vi.fn(),
}));

vi.mock("@/components/CartProvider", () => ({
  useCart: useCartMock,
}));

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
}));

import CartPage from "@/app/[slug]/cart/page";

const fakeItems = [
  { id: "item-1", name: "X-Burguer", priceInCents: 2000, quantity: 2 },
];

function setupMocks(items = fakeItems) {
  useParamsMock.mockReturnValue({ slug: "lanche-do-ze" });
  useCartMock.mockReturnValue({
    items,
    totalInCents: items.reduce((a, i) => a + i.priceInCents * i.quantity, 0),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  });
}

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Finalizar Pedido link to checkout when cart has items", () => {
    setupMocks();
    render(<CartPage />);
    const link = screen.getByRole("link", { name: /finalizar pedido/i });
    expect(link).toHaveAttribute("href", "/lanche-do-ze/checkout");
  });

  it("does not render Finalizar Pedido link when cart is empty", () => {
    setupMocks([]);
    render(<CartPage />);
    expect(
      screen.queryByRole("link", { name: /finalizar pedido/i })
    ).not.toBeInTheDocument();
  });
});
