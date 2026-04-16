import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import CartProvider, { useCart } from "@/components/CartProvider";
import { saveCart } from "@/lib/cart";

// Helper component to expose cart context values for testing
function CartConsumer() {
  const {
    items,
    totalItems,
    totalInCents,
    addItem,
    updateQuantity,
    clearCart,
  } = useCart();

  return (
    <div>
      <span data-testid="total-items">{totalItems}</span>
      <span data-testid="total-cents">{totalInCents}</span>
      <span data-testid="item-count">{items.length}</span>
      <button
        onClick={() =>
          addItem({ id: "item-1", name: "Burger", priceInCents: 1500 })
        }
      >
        Add Burger
      </button>
      <button
        onClick={() =>
          addItem({ id: "item-2", name: "Fries", priceInCents: 800 })
        }
      >
        Add Fries
      </button>
      <button onClick={() => updateQuantity("item-1", 0)}>
        Remove Burger
      </button>
      <button onClick={clearCart}>Clear Cart</button>
    </div>
  );
}

function renderWithProvider(slug = "test-restaurant") {
  return render(
    <CartProvider slug={slug}>
      <CartConsumer />
    </CartProvider>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with empty cart (totalItems = 0)", () => {
    renderWithProvider();
    expect(screen.getByTestId("total-items").textContent).toBe("0");
  });

  it("addItem adds an item (totalItems = 1)", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
    });
    expect(screen.getByTestId("total-items").textContent).toBe("1");
  });

  it("addItem increments quantity if item already in cart", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
      fireEvent.click(screen.getByText("Add Burger"));
    });
    expect(screen.getByTestId("total-items").textContent).toBe("2");
    expect(screen.getByTestId("item-count").textContent).toBe("1");
  });

  it("updateQuantity to 0 removes item", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Remove Burger"));
    });
    expect(screen.getByTestId("total-items").textContent).toBe("0");
    expect(screen.getByTestId("item-count").textContent).toBe("0");
  });

  it("clearCart empties the cart", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
      fireEvent.click(screen.getByText("Add Fries"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Clear Cart"));
    });
    expect(screen.getByTestId("total-items").textContent).toBe("0");
  });

  it("totalItems sums all quantities correctly (2 burgers + 1 fries = 3)", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
      fireEvent.click(screen.getByText("Add Burger"));
      fireEvent.click(screen.getByText("Add Fries"));
    });
    expect(screen.getByTestId("total-items").textContent).toBe("3");
  });

  it("totalInCents computed correctly", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger")); // 1500
      fireEvent.click(screen.getByText("Add Fries")); // 800
    });
    // 1500 + 800 = 2300
    expect(screen.getByTestId("total-cents").textContent).toBe("2300");
  });

  it("cart is persisted to localStorage after adding an item", async () => {
    renderWithProvider("my-slug");
    await act(async () => {
      fireEvent.click(screen.getByText("Add Burger"));
    });
    const stored = localStorage.getItem("cart:my-slug");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("item-1");
  });

  it("loads persisted cart from localStorage on mount", async () => {
    saveCart("my-slug", [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 3 },
    ]);
    renderWithProvider("my-slug");
    // Wait for useEffect to load
    await act(async () => {});
    expect(screen.getByTestId("total-items").textContent).toBe("3");
  });
});
