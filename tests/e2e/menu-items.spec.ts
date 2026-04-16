import { test, expect, type APIRequestContext } from "@playwright/test";

test.describe("MenuItem API", () => {
  const ts = Date.now();

  // Helper to create a restaurant and return the slug
  async function createRestaurant(request: APIRequestContext, suffix: string) {
    const slug = `e2e-mi-${suffix}-${ts}`;
    const res = await request.post("/api/restaurants", {
      data: {
        name: `E2E MenuItem Restaurant ${suffix}`,
        slug,
        email: `e2e-mi-${suffix}-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(res.status()).toBe(201);
    return slug;
  }

  // Helper to create a category and return the category id
  async function createCategory(
    request: APIRequestContext,
    slug: string,
    name: string,
    sortOrder = 0
  ) {
    const res = await request.post(`/api/restaurants/${slug}/categories`, {
      data: { name, sortOrder },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return body as { id: string; name: string; sortOrder: number };
  }

  test("golden path: create an item, retrieve full menu, verify item appears nested under the correct category", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "golden");
    const category = await createCategory(request, slug, "Mains", 1);

    // Create a menu item
    const createItemRes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      {
        data: {
          name: "Cheeseburger",
          priceInCents: 1299,
          description: "A juicy cheeseburger",
        },
      }
    );
    expect(createItemRes.status()).toBe(201);

    const createdItem = await createItemRes.json();
    expect(createdItem.name).toBe("Cheeseburger");
    expect(createdItem.priceInCents).toBe(1299);
    expect(createdItem.description).toBe("A juicy cheeseburger");
    expect(createdItem.id).toBeDefined();
    // isAvailable should default to true
    expect(createdItem.isAvailable).toBe(true);

    // GET /menu and verify item appears nested under the correct category
    const menuRes = await request.get(`/api/restaurants/${slug}/menu`);
    expect(menuRes.status()).toBe(200);

    const menu = await menuRes.json();
    expect(Array.isArray(menu)).toBe(true);
    expect(menu.length).toBeGreaterThanOrEqual(1);

    const foundCategory = menu.find(
      (c: { id: string }) => c.id === category.id
    );
    expect(foundCategory).toBeDefined();
    expect(foundCategory.name).toBe("Mains");

    expect(Array.isArray(foundCategory.menuItems)).toBe(true);
    const foundItem = foundCategory.menuItems.find(
      (i: { id: string }) => i.id === createdItem.id
    );
    expect(foundItem).toBeDefined();
    expect(foundItem.name).toBe("Cheeseburger");
    expect(foundItem.priceInCents).toBe(1299);
    expect(foundItem.description).toBe("A juicy cheeseburger");
  });

  test("only available items appear in consumer menu after soft-delete", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "avail");
    const category = await createCategory(request, slug, "Drinks", 1);

    // Create two menu items
    const itemARes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Lemonade", priceInCents: 499 } }
    );
    expect(itemARes.status()).toBe(201);
    const itemA = await itemARes.json();

    const itemBRes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Iced Tea", priceInCents: 399 } }
    );
    expect(itemBRes.status()).toBe(201);
    const itemB = await itemBRes.json();

    // Verify both appear in the menu
    const menuBeforeRes = await request.get(`/api/restaurants/${slug}/menu`);
    expect(menuBeforeRes.status()).toBe(200);
    const menuBefore = await menuBeforeRes.json();
    const catBefore = menuBefore.find(
      (c: { id: string }) => c.id === category.id
    );
    expect(catBefore.menuItems.length).toBe(2);

    // Soft-delete itemA via DELETE
    const deleteRes = await request.delete(
      `/api/restaurants/${slug}/categories/${category.id}/items/${itemA.id}`
    );
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);

    // GET /menu — itemA should no longer appear, itemB should still be there
    const menuAfterRes = await request.get(`/api/restaurants/${slug}/menu`);
    expect(menuAfterRes.status()).toBe(200);
    const menuAfter = await menuAfterRes.json();

    const catAfter = menuAfter.find((c: { id: string }) => c.id === category.id);
    expect(catAfter).toBeDefined();

    const deletedItem = catAfter.menuItems.find(
      (i: { id: string }) => i.id === itemA.id
    );
    expect(deletedItem).toBeUndefined();

    const remainingItem = catAfter.menuItems.find(
      (i: { id: string }) => i.id === itemB.id
    );
    expect(remainingItem).toBeDefined();
    expect(remainingItem.name).toBe("Iced Tea");
  });

  test("menu is ordered by category sortOrder then item sortOrder", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "order");

    // Create categories out of order
    const catDesserts = await createCategory(request, slug, "Desserts", 10);
    const catAppetizers = await createCategory(request, slug, "Appetizers", 1);
    const catMains = await createCategory(request, slug, "Mains", 5);

    // Add items to Mains in reverse sortOrder
    await request.post(
      `/api/restaurants/${slug}/categories/${catMains.id}/items`,
      { data: { name: "Steak", priceInCents: 2999, sortOrder: 20 } }
    );
    await request.post(
      `/api/restaurants/${slug}/categories/${catMains.id}/items`,
      { data: { name: "Pasta", priceInCents: 1499, sortOrder: 5 } }
    );
    await request.post(
      `/api/restaurants/${slug}/categories/${catMains.id}/items`,
      { data: { name: "Salad", priceInCents: 999, sortOrder: 10 } }
    );

    // Add items to Appetizers
    await request.post(
      `/api/restaurants/${slug}/categories/${catAppetizers.id}/items`,
      { data: { name: "Bruschetta", priceInCents: 699, sortOrder: 2 } }
    );
    await request.post(
      `/api/restaurants/${slug}/categories/${catAppetizers.id}/items`,
      { data: { name: "Soup", priceInCents: 599, sortOrder: 1 } }
    );

    const menuRes = await request.get(`/api/restaurants/${slug}/menu`);
    expect(menuRes.status()).toBe(200);

    const menu = await menuRes.json();
    expect(menu.length).toBe(3);

    // Categories ordered by sortOrder ASC: Appetizers(1), Mains(5), Desserts(10)
    expect(menu[0].id).toBe(catAppetizers.id);
    expect(menu[0].name).toBe("Appetizers");
    expect(menu[0].sortOrder).toBe(1);

    expect(menu[1].id).toBe(catMains.id);
    expect(menu[1].name).toBe("Mains");
    expect(menu[1].sortOrder).toBe(5);

    expect(menu[2].id).toBe(catDesserts.id);
    expect(menu[2].name).toBe("Desserts");
    expect(menu[2].sortOrder).toBe(10);

    // Items in Appetizers ordered by sortOrder ASC: Soup(1), Bruschetta(2)
    expect(menu[0].menuItems[0].name).toBe("Soup");
    expect(menu[0].menuItems[0].sortOrder).toBe(1);
    expect(menu[0].menuItems[1].name).toBe("Bruschetta");
    expect(menu[0].menuItems[1].sortOrder).toBe(2);

    // Items in Mains ordered by sortOrder ASC: Pasta(5), Salad(10), Steak(20)
    expect(menu[1].menuItems[0].name).toBe("Pasta");
    expect(menu[1].menuItems[0].sortOrder).toBe(5);
    expect(menu[1].menuItems[1].name).toBe("Salad");
    expect(menu[1].menuItems[1].sortOrder).toBe(10);
    expect(menu[1].menuItems[2].name).toBe("Steak");
    expect(menu[1].menuItems[2].sortOrder).toBe(20);
  });

  test("GET /api/restaurants/[slug]/menu returns 404 for unknown restaurant slug", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/restaurants/this-slug-does-not-exist-menu-e2e/menu"
    );
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/categories/[id]/items returns 400 when name is missing", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "noname");
    const category = await createCategory(request, slug, "Snacks", 1);

    const res = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { priceInCents: 500 } }
    );

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/categories/[id]/items returns 400 when priceInCents is missing or invalid", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "noprice");
    const category = await createCategory(request, slug, "Beverages", 1);

    // Missing priceInCents
    const resMissing = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Water" } }
    );
    expect(resMissing.status()).toBe(400);
    const bodyMissing = await resMissing.json();
    expect(bodyMissing.error).toBeDefined();

    // Negative priceInCents
    const resNegative = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Water", priceInCents: -100 } }
    );
    expect(resNegative.status()).toBe(400);
    const bodyNegative = await resNegative.json();
    expect(bodyNegative.error).toBeDefined();

    // Zero priceInCents (not a positive integer)
    const resZero = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Water", priceInCents: 0 } }
    );
    expect(resZero.status()).toBe(400);
    const bodyZero = await resZero.json();
    expect(bodyZero.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/categories/[id]/items returns 404 for unknown restaurant slug", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/restaurants/nonexistent-slug-e2e/categories/some-id/items",
      { data: { name: "Burger", priceInCents: 999 } }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("PUT /api/restaurants/[slug]/categories/[id]/items/[itemId] updates item fields", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "update");
    const category = await createCategory(request, slug, "Pizza", 1);

    // Create an item
    const createRes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Margherita", priceInCents: 1099, sortOrder: 1 } }
    );
    expect(createRes.status()).toBe(201);
    const item = await createRes.json();

    // Update name and price
    const updateRes = await request.put(
      `/api/restaurants/${slug}/categories/${category.id}/items/${item.id}`,
      { data: { name: "Pepperoni", priceInCents: 1299 } }
    );
    expect(updateRes.status()).toBe(200);

    const updated = await updateRes.json();
    expect(updated.id).toBe(item.id);
    expect(updated.name).toBe("Pepperoni");
    expect(updated.priceInCents).toBe(1299);
  });

  test("PUT /api/restaurants/[slug]/categories/[id]/items/[itemId] returns 404 for nonexistent item", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "updnotfound");
    const category = await createCategory(request, slug, "Sushi", 1);

    const res = await request.put(
      `/api/restaurants/${slug}/categories/${category.id}/items/nonexistent-item-id`,
      { data: { name: "Salmon Roll" } }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("PUT /api/restaurants/[slug]/categories/[id]/items/[itemId] returns 400 for invalid priceInCents", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "updprice");
    const category = await createCategory(request, slug, "Tacos", 1);

    const createRes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Beef Taco", priceInCents: 799 } }
    );
    expect(createRes.status()).toBe(201);
    const item = await createRes.json();

    const res = await request.put(
      `/api/restaurants/${slug}/categories/${category.id}/items/${item.id}`,
      { data: { priceInCents: -50 } }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("DELETE /api/restaurants/[slug]/categories/[id]/items/[itemId] returns 404 for nonexistent item", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "delnotfound");
    const category = await createCategory(request, slug, "Salads", 1);

    const res = await request.delete(
      `/api/restaurants/${slug}/categories/${category.id}/items/nonexistent-item-id`
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("isAvailable defaults to true when not specified on create", async ({
    request,
  }) => {
    const slug = await createRestaurant(request, "defaultavail");
    const category = await createCategory(request, slug, "Wraps", 1);

    const createRes = await request.post(
      `/api/restaurants/${slug}/categories/${category.id}/items`,
      { data: { name: "Caesar Wrap", priceInCents: 899 } }
    );
    expect(createRes.status()).toBe(201);
    const item = await createRes.json();
    expect(item.isAvailable).toBe(true);

    // Should appear in consumer menu without any explicit isAvailable=true
    const menuRes = await request.get(`/api/restaurants/${slug}/menu`);
    expect(menuRes.status()).toBe(200);
    const menu = await menuRes.json();
    const cat = menu.find((c: { id: string }) => c.id === category.id);
    expect(cat).toBeDefined();
    const found = cat.menuItems.find((i: { id: string }) => i.id === item.id);
    expect(found).toBeDefined();
    expect(found.name).toBe("Caesar Wrap");
  });
});
