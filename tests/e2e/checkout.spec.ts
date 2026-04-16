import { test, expect, type APIRequestContext } from "@playwright/test";

const ts = Date.now();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createRestaurant(
  request: APIRequestContext,
  suffix: string
): Promise<{ slug: string; id: string }> {
  const slug = `e2e-checkout-${suffix}-${ts}`;
  const res = await request.post("/api/restaurants", {
    data: {
      name: `E2E Checkout Restaurant ${suffix}`,
      slug,
      email: `e2e-checkout-${suffix}-${ts}@test.com`,
      password: "secret123",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { slug, id: body.id as string };
}

async function createCategory(
  request: APIRequestContext,
  slug: string,
  name = "Lanches",
  sortOrder = 0
): Promise<{ id: string }> {
  const res = await request.post(`/api/restaurants/${slug}/categories`, {
    data: { name, sortOrder },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createItem(
  request: APIRequestContext,
  slug: string,
  categoryId: string,
  data: { name: string; priceInCents: number; sortOrder?: number }
): Promise<{ id: string; name: string; priceInCents: number }> {
  const res = await request.post(
    `/api/restaurants/${slug}/categories/${categoryId}/items`,
    { data }
  );
  expect(res.status()).toBe(201);
  return res.json();
}

/** Seed the localStorage cart for the given slug before navigating to checkout. */
async function seedCart(
  page: import("@playwright/test").Page,
  slug: string,
  items: Array<{ id: string; name: string; priceInCents: number; quantity: number }>
) {
  // Navigate to any page under the slug so the origin is correct
  await page.goto(`/${slug}`);
  await page.evaluate(
    ([cartKey, cartValue]) => {
      localStorage.setItem(cartKey, cartValue);
    },
    [`cart:${slug}`, JSON.stringify(items)]
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Checkout page", () => {
  test("happy path: fill form, submit, redirect to order status page", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "happy");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "X-Burguer",
      priceInCents: 2000,
      sortOrder: 1,
    });

    // Seed cart with one item
    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    // Navigate to checkout
    await page.goto(`/${restaurant.slug}/checkout`);

    // Fill in customer name
    await page.getByLabel("Nome").fill("Maria Silva");

    // Fill in phone (with mask)
    await page.getByLabel("Telefone").fill("11987654321");

    // Submit
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();

    // Should redirect to /${slug}/pedido/{orderId}
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));

    // Order status page should show order number heading
    await expect(
      page.getByRole("heading", { name: /Pedido #\d+/ })
    ).toBeVisible();
  });

  test("order summary: shows item name, quantity, price, and total", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "summary");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Suco de Laranja",
      priceInCents: 1500,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 2 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    // Item name with quantity ("Suco de Laranja × 2")
    await expect(page.getByText(/Suco de Laranja\s*×\s*2/)).toBeVisible();

    // Unit price "R$ 15,00"
    await expect(page.getByText("R$ 15,00")).toBeVisible();

    // Line total 2 × R$ 15,00 = R$ 30,00 (appears as both the line total and grand total)
    await expect(page.getByText("R$ 30,00").first()).toBeVisible();

    // Grand total label
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("phone mask: digits are formatted as (XX) XXXXX-XXXX", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "mask");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Batata Frita",
      priceInCents: 1000,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    const phoneInput = page.getByLabel("Telefone");
    await phoneInput.fill("11987654321");

    // After typing 11 digits the mask should format as (11) 98765-4321
    await expect(phoneInput).toHaveValue("(11) 98765-4321");
  });

  test("invalid phone: shows 'Telefone inválido' when phone is too short", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "invalid-phone");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Refrigerante",
      priceInCents: 500,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    // Fill name
    await page.getByLabel("Nome").fill("João");

    // Enter fewer than 10 digits
    await page.getByLabel("Telefone").fill("9876");

    // Submit the form
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();

    // Validation error should appear
    await expect(page.getByText("Telefone inválido")).toBeVisible();
  });

  test("empty cart: shows empty state message instead of form", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "empty");

    // Navigate directly to checkout with nothing in the cart
    await page.goto(`/${restaurant.slug}/checkout`);

    // Should show empty cart message
    await expect(page.getByText("Seu carrinho está vazio.")).toBeVisible();

    // Form submit button should not be visible
    await expect(
      page.getByRole("button", { name: "Confirmar Pedido" })
    ).not.toBeVisible();
  });

  test("order status page: shows order number and Portuguese status after successful order", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "status");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Frango Grelhado",
      priceInCents: 2500,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    await page.getByLabel("Nome").fill("Ana Souza");
    await page.getByLabel("Telefone").fill("21987654321");
    await page.getByRole("button", { name: "Confirmar Pedido" }).click();

    // Wait for redirect to order status page
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));

    // Order number heading
    await expect(
      page.getByRole("heading", { name: /Pedido #\d+/ })
    ).toBeVisible();

    // Portuguese status label for CREATED
    await expect(page.getByText("Aguardando pagamento")).toBeVisible();
  });
});
