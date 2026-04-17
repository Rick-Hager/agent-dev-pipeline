import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { Category, MenuItem, MenuItemImage } from "@prisma/client";

type MenuItemWithImages = MenuItem & { images: MenuItemImage[] };
type CategoryWithItems = Category & { menuItems: MenuItemWithImages[] };

// Mock fetch globally
beforeEach(() => {
  global.fetch = vi.fn();
});

import { MenuManager } from "@/components/MenuManager";

const fakeCategories: CategoryWithItems[] = [
  {
    id: "cat-1",
    restaurantId: "rest-1",
    name: "Entradas",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    menuItems: [
      {
        id: "item-1",
        categoryId: "cat-1",
        restaurantId: "rest-1",
        name: "Bruschetta",
        description: "Tomate e manjericão",
        priceInCents: 1500,
        imageUrl: null,
        isAvailable: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
      },
      {
        id: "item-2",
        categoryId: "cat-1",
        restaurantId: "rest-1",
        name: "Pão de alho",
        description: null,
        priceInCents: 800,
        imageUrl: null,
        isAvailable: false,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
      },
    ],
  },
  {
    id: "cat-2",
    restaurantId: "rest-1",
    name: "Pizzas",
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    menuItems: [
      {
        id: "item-3",
        categoryId: "cat-2",
        restaurantId: "rest-1",
        name: "Margherita",
        description: "Molho de tomate, mussarela e manjericão",
        priceInCents: 4500,
        imageUrl: null,
        isAvailable: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
      },
    ],
  },
];

describe("MenuManager", () => {
  it("renders category names", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    expect(screen.getByText("Entradas")).toBeInTheDocument();
    expect(screen.getByText("Pizzas")).toBeInTheDocument();
  });

  it("renders menu item names", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    expect(screen.getByText("Bruschetta")).toBeInTheDocument();
    expect(screen.getByText("Pão de alho")).toBeInTheDocument();
    expect(screen.getByText("Margherita")).toBeInTheDocument();
  });

  it("renders item prices formatted as R$ X,XX", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    expect(screen.getByText("R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 8,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 45,00")).toBeInTheDocument();
  });

  it("shows 'Nova categoria' button", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    expect(screen.getByRole("button", { name: /nova categoria/i })).toBeInTheDocument();
  });

  it("shows 'Novo item' button within each category", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    const newItemButtons = screen.getAllByRole("button", { name: /novo item/i });
    expect(newItemButtons).toHaveLength(2);
  });

  it("shows availability status for each item", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    // One item is unavailable (Pão de alho)
    const unavailableLabels = screen.getAllByText(/indisponível/i);
    expect(unavailableLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows delete button for each category", () => {
    render(<MenuManager slug="test-restaurant" initialCategories={fakeCategories} />);
    // 2 categories, each should have a delete button
    const deleteButtons = screen.getAllByRole("button", { name: /excluir categoria/i });
    expect(deleteButtons).toHaveLength(2);
  });
});
