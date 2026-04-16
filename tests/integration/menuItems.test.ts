import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const TEST_SLUG = "menu-item-test-restaurant";
const MISSING_SLUG = "menu-item-does-not-exist";

let restaurantId: string;
let categoryId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "MenuItem Test Restaurant",
      slug: TEST_SLUG,
      email: "menu-item-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantId = restaurant.id;

  const category = await prisma.category.create({
    data: {
      restaurantId,
      name: "Test Category",
      sortOrder: 0,
    },
  });
  categoryId = category.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
});

// ─── GET /api/restaurants/[slug]/menu ────────────────────────────────────────

describe("GET /api/restaurants/[slug]/menu", () => {
  let category2Id: string;

  beforeAll(async () => {
    const cat2 = await prisma.category.create({
      data: { restaurantId, name: "Category B", sortOrder: 2 },
    });
    category2Id = cat2.id;

    await prisma.menuItem.createMany({
      data: [
        {
          restaurantId,
          categoryId,
          name: "Item A2",
          priceInCents: 500,
          sortOrder: 2,
          isAvailable: true,
        },
        {
          restaurantId,
          categoryId,
          name: "Item A1",
          priceInCents: 300,
          sortOrder: 1,
          isAvailable: true,
        },
        {
          restaurantId,
          categoryId,
          name: "Hidden Item",
          priceInCents: 100,
          sortOrder: 0,
          isAvailable: false,
        },
        {
          restaurantId,
          categoryId: category2Id,
          name: "Item B1",
          priceInCents: 700,
          sortOrder: 0,
          isAvailable: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.category.delete({ where: { id: category2Id } });
  });

  it("returns categories with nested available items ordered correctly", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/menu/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);

    // Category with sortOrder 0 comes first
    const firstCat = body.find(
      (c: { name: string }) => c.name === "Test Category"
    );
    const secondCat = body.find(
      (c: { name: string }) => c.name === "Category B"
    );

    expect(firstCat).toBeDefined();
    expect(secondCat).toBeDefined();
    expect(body.indexOf(firstCat)).toBeLessThan(body.indexOf(secondCat));

    // Only available items
    expect(firstCat.menuItems.length).toBe(2);
    const itemNames = firstCat.menuItems.map(
      (i: { name: string }) => i.name
    );
    expect(itemNames).not.toContain("Hidden Item");

    // Items ordered by sortOrder ASC
    expect(firstCat.menuItems[0].name).toBe("Item A1");
    expect(firstCat.menuItems[1].name).toBe("Item A2");
  });

  it("returns correct shape for menu items", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/menu/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/menu`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    const cat = body.find((c: { name: string }) => c.name === "Category B");
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe("Category B");
    expect(cat.sortOrder).toBeDefined();
    expect(Array.isArray(cat.menuItems)).toBe(true);

    const item = cat.menuItems[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBe("Item B1");
    expect(item.priceInCents).toBe(700);
    expect(item.sortOrder).toBe(0);
  });

  it("returns 404 if restaurant slug not found", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/menu/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/menu`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: MISSING_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns empty array when restaurant has no categories", async () => {
    const emptyRestaurant = await prisma.restaurant.create({
      data: {
        name: "Empty Menu Restaurant",
        slug: "menu-item-empty",
        email: "menu-item-empty@integration-test.com",
        passwordHash: "hashed-password-placeholder",
      },
    });

    try {
      const { GET } = await import("@/app/api/restaurants/[slug]/menu/route");

      const request = new NextRequest(
        `http://localhost:3000/api/restaurants/menu-item-empty/menu`
      );
      const response = await GET(request, {
        params: Promise.resolve({ slug: "menu-item-empty" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      await prisma.restaurant.delete({ where: { id: emptyRestaurant.id } });
    }
  });
});

// ─── POST /api/restaurants/[slug]/categories/[id]/items ──────────────────────

describe("POST /api/restaurants/[slug]/categories/[id]/items", () => {
  afterAll(async () => {
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
  });

  it("creates a menu item with required fields and defaults", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Burger", priceInCents: 1200 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Burger");
    expect(body.priceInCents).toBe(1200);
    expect(body.isAvailable).toBe(true);
    expect(body.sortOrder).toBe(0);
    expect(body.categoryId).toBe(categoryId);
    expect(body.restaurantId).toBe(restaurantId);
  });

  it("creates a menu item with all optional fields", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Fries",
          priceInCents: 500,
          description: "Crispy fries",
          imageUrl: "https://example.com/fries.jpg",
          isAvailable: false,
          sortOrder: 3,
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.description).toBe("Crispy fries");
    expect(body.imageUrl).toBe("https://example.com/fries.jpg");
    expect(body.isAvailable).toBe(false);
    expect(body.sortOrder).toBe(3);
  });

  it("returns 400 if name is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceInCents: 500 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if name is empty string", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   ", priceInCents: 500 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if priceInCents is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza" }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if priceInCents is a float", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza", priceInCents: 9.99 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if priceInCents is zero", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza", priceInCents: 0 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if priceInCents is negative", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza", priceInCents: -100 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if restaurant slug not found", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories/${categoryId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza", priceInCents: 1000 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: MISSING_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if category id not found", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/nonexistent-cat/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pizza", priceInCents: 1000 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: "nonexistent-cat" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});

// ─── PUT /api/restaurants/[slug]/categories/[id]/items/[itemId] ──────────────

describe("PUT /api/restaurants/[slug]/categories/[id]/items/[itemId]", () => {
  let itemId: string;

  beforeAll(async () => {
    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId,
        name: "Original Item",
        priceInCents: 1000,
        sortOrder: 0,
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
  });

  it("updates the item name", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Item" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Updated Item");
    expect(body.id).toBe(itemId);
  });

  it("updates the item priceInCents", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceInCents: 2000 }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.priceInCents).toBe(2000);
  });

  it("updates isAvailable", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: false }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isAvailable).toBe(false);
  });

  it("returns 400 if priceInCents is not a positive integer", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceInCents: -50 }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if restaurant slug not found", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories/${categoryId}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({
        slug: MISSING_SLUG,
        id: categoryId,
        itemId,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if category id not found", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/nonexistent-cat/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({
        slug: TEST_SLUG,
        id: "nonexistent-cat",
        itemId,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if item id not found", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/nonexistent-item`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({
        slug: TEST_SLUG,
        id: categoryId,
        itemId: "nonexistent-item",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});

// ─── DELETE /api/restaurants/[slug]/categories/[id]/items/[itemId] ────────────

describe("DELETE /api/restaurants/[slug]/categories/[id]/items/[itemId]", () => {
  let itemId: string;

  beforeAll(async () => {
    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId,
        name: "Item To Soft-Delete",
        priceInCents: 800,
        sortOrder: 0,
        isAvailable: true,
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
  });

  it("soft-deletes the item by setting isAvailable to false", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/${itemId}`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId, itemId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it is still in the DB but marked unavailable
    const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
    expect(item).not.toBeNull();
    expect(item?.isAvailable).toBe(false);
  });

  it("returns 404 if restaurant slug not found", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories/${categoryId}/items/${itemId}`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({
        slug: MISSING_SLUG,
        id: categoryId,
        itemId,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if category id not found", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/nonexistent-cat/items/${itemId}`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({
        slug: TEST_SLUG,
        id: "nonexistent-cat",
        itemId,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if item id not found", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/items/[itemId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}/items/nonexistent-item`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({
        slug: TEST_SLUG,
        id: categoryId,
        itemId: "nonexistent-item",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});
