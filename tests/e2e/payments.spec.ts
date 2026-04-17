import { test, expect, type APIRequestContext } from "@playwright/test";

async function createRestaurant(
  request: APIRequestContext,
  suffix: string
): Promise<{ slug: string; id: string }> {
  const ts = Date.now();
  const slug = `e2e-pay-${suffix}-${ts}`;
  const res = await request.post("/api/restaurants", {
    data: {
      name: `E2E Payments ${suffix}`,
      slug,
      email: `e2e-pay-${suffix}-${ts}@test.com`,
      password: "secret123",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { slug, id: body.id as string };
}

async function createCategory(
  request: APIRequestContext,
  slug: string
): Promise<{ id: string }> {
  const res = await request.post(`/api/restaurants/${slug}/categories`, {
    data: { name: "Lanches", sortOrder: 0 },
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

async function seedCart(
  page: import("@playwright/test").Page,
  slug: string,
  items: Array<{ id: string; name: string; priceInCents: number; quantity: number }>
) {
  // Navigate to a page outside the [slug] layout so CartProvider doesn't
  // mount and overwrite localStorage with an empty cart via its useEffect.
  await page.goto(`/backoffice/login`);
  await page.evaluate(
    ([cartKey, cartValue]) => {
      localStorage.setItem(cartKey, cartValue);
    },
    [`cart:${slug}`, JSON.stringify(items)]
  );
}

test.describe("Payments (MercadoPago)", () => {
  test("checkout page shows payment method radios (PIX and Cartão)", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "radios");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "X-Salada",
      priceInCents: 1500,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    await expect(page.getByLabel(/PIX/i)).toBeVisible();
    await expect(page.getByLabel(/Cart[ãa]o/i)).toBeVisible();

    // PIX should be the default selection
    await expect(page.getByLabel(/PIX/i)).toBeChecked();
  });

  test('checkout button is labeled "Ir para pagamento"', async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "label");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Pastel",
      priceInCents: 800,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);

    await expect(
      page.getByRole("button", { name: /ir para pagamento/i })
    ).toBeVisible();
  });

  test("submitting checkout without MercadoPago token still places order and redirects to pedido", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "notoken");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Batata",
      priceInCents: 1000,
      sortOrder: 1,
    });

    await seedCart(page, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.goto(`/${restaurant.slug}/checkout`);
    await page.getByLabel("Nome").fill("João");
    await page.getByLabel("Telefone").fill("11987654321");
    await page.getByRole("button", { name: /ir para pagamento/i }).click();

    // Without a MercadoPago access token, the pay API fails and the
    // checkout page falls back to redirecting to the order status page.
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));
  });

  test("mercadopago webhook accepts payment notification and returns 200", async ({
    request,
  }) => {
    // The webhook should accept valid payment notifications and return 200,
    // even when no restaurant has MercadoPago configured (no access token).
    const res = await request.post("/api/webhooks/mercadopago", {
      data: {
        type: "payment",
        data: { id: `mp_e2e_test_${Date.now()}` },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
