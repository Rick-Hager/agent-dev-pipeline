import { test, expect } from "@playwright/test";

test.describe("Category API", () => {
  const ts = Date.now();
  const slug = `e2e-cat-${ts}`;
  const email = `e2e-cat-${ts}@test.com`;

  // Create a restaurant once before all category tests in this describe block.
  // Each test that needs a clean slate creates its own restaurant with a unique slug.

  test("create a category via API and list categories for a restaurant", async ({
    request,
  }) => {
    // Step 1: Create a restaurant
    const createRestaurantRes = await request.post("/api/restaurants", {
      data: {
        name: "E2E Category Restaurant",
        slug,
        email,
        password: "secret123",
      },
    });
    expect(createRestaurantRes.status()).toBe(201);

    // Step 2: Create a category
    const createCategoryRes = await request.post(
      `/api/restaurants/${slug}/categories`,
      {
        data: {
          name: "Burgers",
          sortOrder: 1,
        },
      }
    );
    expect(createCategoryRes.status()).toBe(201);

    const createdCategory = await createCategoryRes.json();
    expect(createdCategory.name).toBe("Burgers");
    expect(createdCategory.sortOrder).toBe(1);
    expect(createdCategory.id).toBeDefined();

    // Step 3: List categories and verify the new one appears
    const listRes = await request.get(`/api/restaurants/${slug}/categories`);
    expect(listRes.status()).toBe(200);

    const categories = await listRes.json();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThanOrEqual(1);

    const found = categories.find(
      (c: { id: string }) => c.id === createdCategory.id
    );
    expect(found).toBeDefined();
    expect(found.name).toBe("Burgers");
    expect(found.sortOrder).toBe(1);
  });

  test("categories are ordered by sortOrder ASC", async ({ request }) => {
    const orderedSlug = `e2e-cat-order-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "Order Test Restaurant",
        slug: orderedSlug,
        email: `e2e-cat-order-${ts}@test.com`,
        password: "secret123",
      },
    });

    // Create category with higher sortOrder first
    await request.post(`/api/restaurants/${orderedSlug}/categories`, {
      data: { name: "Desserts", sortOrder: 10 },
    });

    // Create category with lower sortOrder second
    await request.post(`/api/restaurants/${orderedSlug}/categories`, {
      data: { name: "Appetizers", sortOrder: 1 },
    });

    // Create category with middle sortOrder third
    await request.post(`/api/restaurants/${orderedSlug}/categories`, {
      data: { name: "Mains", sortOrder: 5 },
    });

    const listRes = await request.get(
      `/api/restaurants/${orderedSlug}/categories`
    );
    expect(listRes.status()).toBe(200);

    const categories = await listRes.json();
    expect(categories.length).toBe(3);

    // Assert ascending order
    expect(categories[0].name).toBe("Appetizers");
    expect(categories[0].sortOrder).toBe(1);
    expect(categories[1].name).toBe("Mains");
    expect(categories[1].sortOrder).toBe(5);
    expect(categories[2].name).toBe("Desserts");
    expect(categories[2].sortOrder).toBe(10);
  });

  test("POST /api/restaurants/[slug]/categories returns 404 for unknown restaurant slug", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/restaurants/this-slug-does-not-exist-e2e/categories",
      {
        data: { name: "Drinks" },
      }
    );

    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("PUT /api/restaurants/[slug]/categories/[id] updates the category correctly", async ({
    request,
  }) => {
    const updateSlug = `e2e-cat-update-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "Update Test Restaurant",
        slug: updateSlug,
        email: `e2e-cat-update-${ts}@test.com`,
        password: "secret123",
      },
    });

    // Create a category to update
    const createRes = await request.post(
      `/api/restaurants/${updateSlug}/categories`,
      {
        data: { name: "Original Name", sortOrder: 0 },
      }
    );
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Update the category
    const updateRes = await request.put(
      `/api/restaurants/${updateSlug}/categories/${created.id}`,
      {
        data: { name: "Updated Name", sortOrder: 99 },
      }
    );
    expect(updateRes.status()).toBe(200);

    const updated = await updateRes.json();
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Updated Name");
    expect(updated.sortOrder).toBe(99);
  });

  test("DELETE /api/restaurants/[slug]/categories/[id] removes the category", async ({
    request,
  }) => {
    const deleteSlug = `e2e-cat-delete-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "Delete Test Restaurant",
        slug: deleteSlug,
        email: `e2e-cat-delete-${ts}@test.com`,
        password: "secret123",
      },
    });

    // Create a category to delete
    const createRes = await request.post(
      `/api/restaurants/${deleteSlug}/categories`,
      {
        data: { name: "To Be Deleted", sortOrder: 0 },
      }
    );
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Delete the category
    const deleteRes = await request.delete(
      `/api/restaurants/${deleteSlug}/categories/${created.id}`
    );
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);

    // Verify the category no longer appears in the list
    const listRes = await request.get(
      `/api/restaurants/${deleteSlug}/categories`
    );
    expect(listRes.status()).toBe(200);

    const categories = await listRes.json();
    const found = categories.find(
      (c: { id: string }) => c.id === created.id
    );
    expect(found).toBeUndefined();
  });

  test("GET /api/restaurants/[slug]/categories returns 404 for unknown restaurant slug", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/restaurants/this-slug-does-not-exist-e2e/categories"
    );

    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/categories returns 400 when name is missing", async ({
    request,
  }) => {
    const missingNameSlug = `e2e-cat-noname-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "No Name Category Restaurant",
        slug: missingNameSlug,
        email: `e2e-cat-noname-${ts}@test.com`,
        password: "secret123",
      },
    });

    const res = await request.post(
      `/api/restaurants/${missingNameSlug}/categories`,
      {
        data: { sortOrder: 1 },
      }
    );

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/categories defaults sortOrder to 0 when not provided", async ({
    request,
  }) => {
    const defaultOrderSlug = `e2e-cat-deforder-${ts}`;

    await request.post("/api/restaurants", {
      data: {
        name: "Default Order Restaurant",
        slug: defaultOrderSlug,
        email: `e2e-cat-deforder-${ts}@test.com`,
        password: "secret123",
      },
    });

    const res = await request.post(
      `/api/restaurants/${defaultOrderSlug}/categories`,
      {
        data: { name: "No Sort Order" },
      }
    );

    expect(res.status()).toBe(201);

    const category = await res.json();
    expect(category.name).toBe("No Sort Order");
    expect(category.sortOrder).toBe(0);
  });
});
