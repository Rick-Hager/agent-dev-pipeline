import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CartItem,
  getCartKey,
  loadCart,
  saveCart,
  addItemToCart,
  updateItemQuantity,
  getTotalItems,
  getTotalInCents,
} from "@/lib/cart";

describe("getCartKey", () => {
  it("returns 'cart:{slug}'", () => {
    expect(getCartKey("my-restaurant")).toBe("cart:my-restaurant");
  });
});

describe("addItemToCart", () => {
  it("adds a new item with quantity 1", () => {
    const result = addItemToCart([], {
      id: "item-1",
      name: "Burger",
      priceInCents: 1500,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "item-1",
      name: "Burger",
      priceInCents: 1500,
      quantity: 1,
    });
  });

  it("increments quantity if item already exists", () => {
    const existing: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
    ];
    const result = addItemToCart(existing, {
      id: "item-1",
      name: "Burger",
      priceInCents: 1500,
    });
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });

  it("adds a second different item alongside an existing one", () => {
    const existing: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 1 },
    ];
    const result = addItemToCart(existing, {
      id: "item-2",
      name: "Fries",
      priceInCents: 800,
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      id: "item-2",
      name: "Fries",
      priceInCents: 800,
      quantity: 1,
    });
  });
});

describe("updateItemQuantity", () => {
  it("updates quantity of an item", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 1 },
    ];
    const result = updateItemQuantity(items, "item-1", 5);
    expect(result[0].quantity).toBe(5);
  });

  it("removes item when quantity is 0", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
    ];
    const result = updateItemQuantity(items, "item-1", 0);
    expect(result).toHaveLength(0);
  });

  it("removes item when quantity is negative", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
    ];
    const result = updateItemQuantity(items, "item-1", -1);
    expect(result).toHaveLength(0);
  });
});

describe("getTotalItems", () => {
  it("returns 0 for empty cart", () => {
    expect(getTotalItems([])).toBe(0);
  });

  it("sums quantities correctly", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
      { id: "item-2", name: "Fries", priceInCents: 800, quantity: 3 },
    ];
    expect(getTotalItems(items)).toBe(5);
  });
});

describe("getTotalInCents", () => {
  it("returns 0 for empty cart", () => {
    expect(getTotalInCents([])).toBe(0);
  });

  it("computes price × quantity sum", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
      { id: "item-2", name: "Fries", priceInCents: 800, quantity: 3 },
    ];
    // 1500*2 + 800*3 = 3000 + 2400 = 5400
    expect(getTotalInCents(items)).toBe(5400);
  });
});

describe("loadCart and saveCart", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when nothing is stored", () => {
    expect(loadCart("my-restaurant")).toEqual([]);
  });

  it("saveCart + loadCart round-trip works", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 2 },
    ];
    saveCart("my-restaurant", items);
    expect(loadCart("my-restaurant")).toEqual(items);
  });

  it("is isolated per slug — different slugs don't share carts", () => {
    const items: CartItem[] = [
      { id: "item-1", name: "Burger", priceInCents: 1500, quantity: 1 },
    ];
    saveCart("restaurant-a", items);
    expect(loadCart("restaurant-b")).toEqual([]);
  });
});
