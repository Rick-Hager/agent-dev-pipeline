import { test, expect, type APIRequestContext } from "@playwright/test";

test.describe("Consumer Menu", () => {
  const ts = Date.now();

  // Helper to create a restaurant via API and return the slug
  async function createRestaurant(request: APIRequestContext, suffix: string) {
    const slug = `e2e-menu-${suffix}-${ts}`;
    const res = await request.post("/api/restaurants", {
      data: {
        name: `E2E Menu Restaurant ${suffix}`,
        slug,
        email: `e2e-menu-${suffix}-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return { slug, id: body.id as string, name: body.name as string };
  }

  // Helper to create a category and return the category object
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

  // Helper to create a menu item
  async function createItem(
    request: APIRequestContext,
    slug: string,
    categoryId: string,
    data: {
      name: string;
      priceInCents: number;
      description?: string;
      sortOrder?: number;
    }
  ) {
    const res = await request.post(
      `/api/restaurants/${slug}/categories/${categoryId}/items`,
      { data }
    );
    expect(res.status()).toBe(201);
    return res.json();
  }

  test("/{slug} renders the restaurant name as a heading", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "name");
    await createCategory(request, restaurant.slug, "Starters", 1);

    await page.goto(`/${restaurant.slug}`);

    await expect(
      page.getByRole("heading", { name: restaurant.name })
    ).toBeVisible();
  });

  test("menu is organized by categories shown as section headers", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "cats");

    await createCategory(request, restaurant.slug, "Appetizers", 1);
    await createCategory(request, restaurant.slug, "Main Dishes", 2);
    await createCategory(request, restaurant.slug, "Desserts", 3);

    await page.goto(`/${restaurant.slug}`);

    await expect(
      page.getByRole("heading", { name: "Appetizers" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Main Dishes" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Desserts" })
    ).toBeVisible();
  });

  test("each menu item shows name, description, and formatted price", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "items");
    const category = await createCategory(
      request,
      restaurant.slug,
      "Burgers",
      1
    );

    await createItem(request, restaurant.slug, category.id, {
      name: "Cheeseburger",
      priceInCents: 1290,
      description: "A juicy beef patty with melted cheese",
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Item name should be visible
    await expect(page.getByText("Cheeseburger")).toBeVisible();

    // Description should be visible
    await expect(
      page.getByText("A juicy beef patty with melted cheese")
    ).toBeVisible();

    // Price formatted as R$ 12,90
    await expect(page.getByText("R$ 12,90")).toBeVisible();
  });

  test("price is formatted correctly as R$ X,XX (e.g. R$ 9,99 for 999 cents)", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "price");
    const category = await createCategory(
      request,
      restaurant.slug,
      "Drinks",
      1
    );

    await createItem(request, restaurant.slug, category.id, {
      name: "Orange Juice",
      priceInCents: 999,
    });

    await page.goto(`/${restaurant.slug}`);

    await expect(page.getByText("R$ 9,99")).toBeVisible();
  });

  test("item without description does not show a description element", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "nodesc");
    const category = await createCategory(
      request,
      restaurant.slug,
      "Snacks",
      1
    );

    await createItem(request, restaurant.slug, category.id, {
      name: "Plain Chips",
      priceInCents: 500,
      // no description
    });

    await page.goto(`/${restaurant.slug}`);

    await expect(page.getByText("Plain Chips")).toBeVisible();
    // No description element should be rendered for this item
    await expect(page.getByTestId("item-description")).not.toBeVisible();
  });

  test("categories and items are ordered by sortOrder", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "order");

    const catMains = await createCategory(
      request,
      restaurant.slug,
      "Mains",
      5
    );
    const catStarters = await createCategory(
      request,
      restaurant.slug,
      "Starters",
      1
    );
    const catDesserts = await createCategory(
      request,
      restaurant.slug,
      "Desserts",
      10
    );

    await createItem(request, restaurant.slug, catMains.id, {
      name: "Steak",
      priceInCents: 2999,
      sortOrder: 2,
    });
    await createItem(request, restaurant.slug, catMains.id, {
      name: "Pasta",
      priceInCents: 1499,
      sortOrder: 1,
    });
    await createItem(request, restaurant.slug, catStarters.id, {
      name: "Soup",
      priceInCents: 599,
    });

    await page.goto(`/${restaurant.slug}`);

    const headings = page.getByRole("heading", { level: 2 });
    const headingTexts = await headings.allTextContents();

    // Categories should appear in sortOrder: Starters(1), Mains(5), Desserts(10)
    expect(headingTexts[0]).toBe("Starters");
    expect(headingTexts[1]).toBe("Mains");
    expect(headingTexts[2]).toBe("Desserts");

    // Items in Mains should appear in sortOrder: Pasta(1), Steak(2)
    // Locate the section containing the "Mains" heading via CSS
    const mainsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mains" }) });
    const itemNames = await mainsSection.getByRole("listitem").allTextContents();
    // Pasta has sortOrder 1, Steak has sortOrder 2 — Pasta should appear first
    expect(itemNames[0]).toContain("Pasta");
    expect(itemNames[1]).toContain("Steak");
  });

  test("navigating to /{nonexistent-slug} shows a 404 page", async ({
    page,
  }) => {
    const response = await page.goto(
      "/nonexistent-slug-that-does-not-exist-99999"
    );

    // Next.js notFound() results in a 404 status
    expect(response?.status()).toBe(404);
  });

  test("404 page shows 'not found' content for nonexistent slug", async ({
    page,
  }) => {
    await page.goto("/nonexistent-slug-that-does-not-exist-88888");

    // Next.js default 404 page renders text indicating not found
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toMatch(/not found|404/);
  });
});
