import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const TEST_SLUG = "cat-test-restaurant";
const MISSING_SLUG = "cat-test-does-not-exist";

let restaurantId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Category Test Restaurant",
      slug: TEST_SLUG,
      email: "cat-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantId = restaurant.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
});

// ─── GET /api/restaurants/[slug]/categories ───────────────────────────────────

describe("GET /api/restaurants/[slug]/categories", () => {
  beforeAll(async () => {
    // Create categories in non-sequential sortOrder to verify ordering
    await prisma.category.createMany({
      data: [
        { restaurantId, name: "Desserts", sortOrder: 2 },
        { restaurantId, name: "Starters", sortOrder: 0 },
        { restaurantId, name: "Mains", sortOrder: 1 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { restaurantId } });
  });

  it("returns categories ordered by sortOrder ASC", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
    expect(body[0].name).toBe("Starters");
    expect(body[1].name).toBe("Mains");
    expect(body[2].name).toBe("Desserts");
  });

  it("returns empty array when restaurant has no categories", async () => {
    const emptyRestaurant = await prisma.restaurant.create({
      data: {
        name: "Empty Restaurant",
        slug: "cat-test-empty",
        email: "cat-empty@integration-test.com",
        passwordHash: "hashed-password-placeholder",
      },
    });

    try {
      const { GET } = await import(
        "@/app/api/restaurants/[slug]/categories/route"
      );

      const request = new NextRequest(
        `http://localhost:3000/api/restaurants/cat-test-empty/categories`
      );
      const response = await GET(request, {
        params: Promise.resolve({ slug: "cat-test-empty" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      await prisma.restaurant.delete({ where: { id: emptyRestaurant.id } });
    }
  });
});

// ─── POST /api/restaurants/[slug]/categories ──────────────────────────────────

describe("POST /api/restaurants/[slug]/categories", () => {
  afterAll(async () => {
    await prisma.category.deleteMany({ where: { restaurantId } });
  });

  it("creates a category with name and default sortOrder", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Beverages" }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Beverages");
    expect(body.sortOrder).toBe(0);
    expect(body.id).toBeDefined();
    expect(body.restaurantId).toBe(restaurantId);
  });

  it("creates a category with explicit sortOrder", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Specials", sortOrder: 5 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Specials");
    expect(body.sortOrder).toBe(5);
  });

  it("returns 404 if restaurant slug does not exist", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost Category" }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: MISSING_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if name is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: 1 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if name is empty string", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/categories/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ─── PUT /api/restaurants/[slug]/categories/[id] ─────────────────────────────

describe("PUT /api/restaurants/[slug]/categories/[id]", () => {
  let categoryId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { restaurantId, name: "Original Name", sortOrder: 0 },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { restaurantId } });
  });

  it("updates the category name", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Updated Name");
    expect(body.id).toBe(categoryId);
  });

  it("updates the category sortOrder", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: 10 }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sortOrder).toBe(10);
  });

  it("returns 404 if restaurant slug does not exist", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories/${categoryId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: MISSING_SLUG, id: categoryId }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if category id does not exist", async () => {
    const { PUT } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/nonexistent-id`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: "nonexistent-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});

// ─── DELETE /api/restaurants/[slug]/categories/[id] ──────────────────────────

describe("DELETE /api/restaurants/[slug]/categories/[id]", () => {
  let categoryId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { restaurantId, name: "To Be Deleted", sortOrder: 0 },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { restaurantId } });
  });

  it("deletes the category and returns 200", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/${categoryId}`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: categoryId }),
    });

    expect(response.status).toBe(200);

    // Verify it is actually deleted
    const deleted = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    expect(deleted).toBeNull();
  });

  it("returns 404 if restaurant slug does not exist", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${MISSING_SLUG}/categories/some-id`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: MISSING_SLUG, id: "some-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 404 if category id does not exist", async () => {
    const { DELETE } = await import(
      "@/app/api/restaurants/[slug]/categories/[id]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/categories/nonexistent-id`,
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ slug: TEST_SLUG, id: "nonexistent-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});
