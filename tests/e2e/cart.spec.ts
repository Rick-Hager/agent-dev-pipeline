import { test, expect, type APIRequestContext } from "@playwright/test";

test.describe("Shopping Cart", () => {
  const ts = Date.now();

  // Helper to create a restaurant via API and return the slug
  async function createRestaurant(request: APIRequestContext, suffix: string) {
    const slug = `e2e-cart-${suffix}-${ts}`;
    const res = await request.post("/api/restaurants", {
      data: {
        name: `E2E Cart Restaurant ${suffix}`,
        slug,
        email: `e2e-cart-${suffix}-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return { slug, id: body.id as string, name: body.name as string };
  }

  // Helper to create a category
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

  test("Adicionar button adds item to cart and badge shows count", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "badge1");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "X-Burguer",
      priceInCents: 2000,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Badge should not be visible initially (totalItems is 0, span is not rendered)
    await expect(page.getByTestId("cart-badge-count")).not.toBeVisible();

    // Click "Adicionar"
    await page.getByRole("button", { name: "Adicionar" }).click();

    // Badge should now show "1"
    await expect(page.getByTestId("cart-badge-count")).toBeVisible();
    await expect(page.getByTestId("cart-badge-count")).toHaveText("1");
  });

  test("clicking Adicionar again increments cart count", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "badge2");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "X-Bacon",
      priceInCents: 2500,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    const addButton = page.getByRole("button", { name: "Adicionar" });

    // Add item twice
    await addButton.click();
    await addButton.click();

    // Badge should show "2"
    await expect(page.getByTestId("cart-badge-count")).toHaveText("2");
  });

  test("cart page shows item name, unit price, quantity, and line total", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "cartpage1");
    const category = await createCategory(request, restaurant.slug, "Bebidas", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Suco de Laranja",
      priceInCents: 1500,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Add item to cart
    await page.getByRole("button", { name: "Adicionar" }).click();

    // Navigate to cart page
    await page.goto(`/${restaurant.slug}/cart`);

    // Item name should be visible
    await expect(page.getByText("Suco de Laranja")).toBeVisible();

    // Unit price "R$ 15,00" should be visible — the <p> element with class text-zinc-500
    await expect(page.locator("p.text-zinc-500").filter({ hasText: "R$ 15,00" })).toBeVisible();

    // Quantity should show "1"
    await expect(page.getByTestId("item-quantity")).toHaveText("1");

    // Line total "R$ 15,00" for qty 1 — the <span> with ml-auto class
    await expect(page.locator("span.ml-auto").filter({ hasText: "R$ 15,00" })).toBeVisible();

    // Grand total label
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("cart page shows grand total", async ({ page, request }) => {
    const restaurant = await createRestaurant(request, "total1");
    const category = await createCategory(request, restaurant.slug, "Pratos", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Frango Grelhado",
      priceInCents: 2000,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Add the same item twice (quantity = 2, total = R$ 40,00)
    const addButton = page.getByRole("button", { name: "Adicionar" });
    await addButton.click();
    await addButton.click();

    // Navigate to cart
    await page.goto(`/${restaurant.slug}/cart`);

    // Total label and formatted total (R$ 40,00) should be visible
    // The grand total is in a flex div with "Total" label and formatted total span
    await expect(page.getByText("Total")).toBeVisible();
    // Use the grand total span (the one directly following the "Total" label)
    const totalRow = page.locator("div.flex.justify-between.font-bold");
    await expect(totalRow).toContainText("R$ 40,00");
  });

  test("increase quantity button increments item quantity", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "increase1");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Batata Frita",
      priceInCents: 1000,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);
    await page.getByRole("button", { name: "Adicionar" }).click();

    // Navigate to cart
    await page.goto(`/${restaurant.slug}/cart`);

    // Verify initial quantity is 1
    await expect(page.getByTestId("item-quantity")).toHaveText("1");

    // Click "Aumentar quantidade"
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();

    // Quantity should now be 2
    await expect(page.getByTestId("item-quantity")).toHaveText("2");

    // Line total should now be R$ 20,00 (2 × R$ 10,00)
    await expect(page.locator("span.ml-auto").filter({ hasText: "R$ 20,00" })).toBeVisible();
  });

  test("decrease quantity button decrements item quantity", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "decrease1");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Refrigerante",
      priceInCents: 500,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Add item twice via "Adicionar" button so qty = 2
    const addButton = page.getByRole("button", { name: "Adicionar" });
    await addButton.click();
    await addButton.click();

    // Navigate to cart
    await page.goto(`/${restaurant.slug}/cart`);

    // Verify initial quantity is 2
    await expect(page.getByTestId("item-quantity")).toHaveText("2");

    // Click "Diminuir quantidade"
    await page.getByRole("button", { name: "Diminuir quantidade" }).click();

    // Quantity should now be 1
    await expect(page.getByTestId("item-quantity")).toHaveText("1");
  });

  test("decreasing quantity to 0 removes item from cart", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "remove1");
    const category = await createCategory(request, restaurant.slug, "Sobremesas", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Pudim",
      priceInCents: 800,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);
    await page.getByRole("button", { name: "Adicionar" }).click();

    // Navigate to cart
    await page.goto(`/${restaurant.slug}/cart`);

    // Verify item is in cart
    await expect(page.getByText("Pudim")).toBeVisible();

    // Decrease quantity to 0 — removes the item
    await page.getByRole("button", { name: "Diminuir quantidade" }).click();

    // Cart should be empty
    await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();
  });

  test("Limpar carrinho removes all items", async ({ page, request }) => {
    const restaurant = await createRestaurant(request, "clear1");
    const category = await createCategory(request, restaurant.slug, "Menu", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Item Alpha",
      priceInCents: 1000,
      sortOrder: 1,
    });
    await createItem(request, restaurant.slug, category.id, {
      name: "Item Beta",
      priceInCents: 1200,
      sortOrder: 2,
    });

    await page.goto(`/${restaurant.slug}`);

    // Add both items
    const addButtons = page.getByRole("button", { name: "Adicionar" });
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    // Navigate to cart
    await page.goto(`/${restaurant.slug}/cart`);

    // Verify items are present
    await expect(page.getByText("Item Alpha")).toBeVisible();
    await expect(page.getByText("Item Beta")).toBeVisible();

    // Click "Limpar carrinho"
    await page.getByRole("button", { name: "Limpar carrinho" }).click();

    // Cart should be empty
    await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();
  });

  test("empty cart page shows empty message", async ({ page, request }) => {
    const restaurant = await createRestaurant(request, "empty1");

    // Navigate directly to cart page without adding any items
    await page.goto(`/${restaurant.slug}/cart`);

    // Empty state message should be visible
    await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();
  });

  test("Finalizar Pedido button navigates to checkout page", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "finalize1");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "X-Tudo",
      priceInCents: 3000,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);
    await page.getByRole("button", { name: "Adicionar" }).click();

    await page.goto(`/${restaurant.slug}/cart`);

    await page.getByRole("link", { name: "Finalizar Pedido" }).click();

    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/checkout$`));
  });

  test("empty cart does not show Finalizar Pedido button", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "finalize2");

    await page.goto(`/${restaurant.slug}/cart`);

    await expect(
      page.getByRole("link", { name: "Finalizar Pedido" })
    ).toHaveCount(0);
  });

  test("cart badge link navigates to cart page", async ({ page, request }) => {
    const restaurant = await createRestaurant(request, "navlink1");
    const category = await createCategory(request, restaurant.slug, "Lanches", 1);
    await createItem(request, restaurant.slug, category.id, {
      name: "Hamburguer",
      priceInCents: 1800,
      sortOrder: 1,
    });

    await page.goto(`/${restaurant.slug}`);

    // Add item so badge becomes visible
    await page.getByRole("button", { name: "Adicionar" }).click();

    // Click "Ver carrinho" link (the CartBadge link)
    await page.getByRole("link", { name: "Ver carrinho" }).click();

    // Should be on the cart page with h1 "Carrinho"
    await expect(page.getByRole("heading", { name: "Carrinho" })).toBeVisible();
  });
});
