import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Use vi.hoisted so the mock objects are available when vi.mock factories run
const { notFoundMock, prismaMock } = vi.hoisted(() => {
  const notFoundMock = vi.fn();
  const prismaMock = {
    restaurant: {
      findUnique: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  };
  return { notFoundMock, prismaMock };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// Import page AFTER mocks are registered
import MenuPage from "@/app/[slug]/page";

const fakeRestaurant = {
  id: "rest-1",
  name: "Pizza Palace",
  slug: "pizza-palace",
};

const fakeCategories = [
  {
    id: "cat-1",
    name: "Entradas",
    sortOrder: 1,
    menuItems: [
      {
        id: "item-1",
        name: "Bruschetta",
        description: "Tomate e manjericão",
        priceInCents: 1500,
        sortOrder: 1,
      },
      {
        id: "item-2",
        name: "Pão de alho",
        description: null,
        priceInCents: 800,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "cat-2",
    name: "Pizzas",
    sortOrder: 2,
    menuItems: [
      {
        id: "item-3",
        name: "Margherita",
        description: "Molho de tomate, mussarela e manjericão",
        priceInCents: 4500,
        sortOrder: 1,
      },
    ],
  },
];

async function renderMenuPage(slug: string) {
  const jsx = await MenuPage({ params: Promise.resolve({ slug }) });
  render(jsx as React.ReactElement);
}

describe("MenuPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.findUnique.mockResolvedValue(fakeRestaurant);
    prismaMock.category.findMany.mockResolvedValue(fakeCategories);
  });

  it("renders the restaurant name as h1", async () => {
    await renderMenuPage("pizza-palace");
    expect(
      screen.getByRole("heading", { level: 1, name: "Pizza Palace" })
    ).toBeInTheDocument();
  });

  it("renders category names as h2 headers", async () => {
    await renderMenuPage("pizza-palace");
    expect(
      screen.getByRole("heading", { level: 2, name: "Entradas" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pizzas" })
    ).toBeInTheDocument();
  });

  it("renders menu item names", async () => {
    await renderMenuPage("pizza-palace");
    expect(screen.getByText("Bruschetta")).toBeInTheDocument();
    expect(screen.getByText("Pão de alho")).toBeInTheDocument();
    expect(screen.getByText("Margherita")).toBeInTheDocument();
  });

  it("renders menu item descriptions when not null", async () => {
    await renderMenuPage("pizza-palace");
    expect(screen.getByText("Tomate e manjericão")).toBeInTheDocument();
    expect(
      screen.getByText("Molho de tomate, mussarela e manjericão")
    ).toBeInTheDocument();
  });

  it("does not render a description element for items with null description", async () => {
    await renderMenuPage("pizza-palace");
    // Only items with non-null description should have data-testid="item-description"
    const descriptions = screen.queryAllByTestId("item-description");
    expect(descriptions).toHaveLength(2);
  });

  it("renders prices in R$ X,XX format", async () => {
    await renderMenuPage("pizza-palace");
    expect(screen.getByText("R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 8,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 45,00")).toBeInTheDocument();
  });

  it("calls notFound when restaurant does not exist", async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue(null);
    await expect(renderMenuPage("unknown-slug")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
