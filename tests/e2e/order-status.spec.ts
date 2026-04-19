import { test, expect, type APIRequestContext } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createRestaurant(
  request: APIRequestContext,
  suffix: string
): Promise<{ slug: string; id: string }> {
  const ts = Date.now();
  const slug = `e2e-os-${suffix}-${ts}`;
  const res = await request.post("/api/restaurants", {
    data: {
      name: `E2E Order Status ${suffix}`,
      slug,
      email: `e2e-os-${suffix}-${ts}@test.com`,
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

/** Create an order via the API and navigate to its status page. */
async function placeOrder(
  page: import("@playwright/test").Page,
  request: APIRequestContext,
  slug: string,
  items: Array<{
    id: string;
    name: string;
    priceInCents: number;
    quantity: number;
  }>,
  customerName = "João Teste",
  phone = "11987654321"
): Promise<string> {
  const res = await request.post(`/api/restaurants/${slug}/orders`, {
    data: {
      customerName,
      customerPhone: phone,
      customerEmail: "e2e@test.com",
      items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: string };
  await page.goto(`/${slug}/pedido/${body.id}`);
  return body.id;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Order Status Page", () => {
  test("shows customer name and formatted date/time on order status page", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "customer");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Hambúrguer",
      priceInCents: 2500,
      sortOrder: 1,
    });

    await placeOrder(
      page,
      request,
      restaurant.slug,
      [{ id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 }],
      "Carlos Souza"
    );

    // Customer name should be displayed
    await expect(page.getByText("Carlos Souza")).toBeVisible();

    // Date/time element should be present (formatted in pt-BR locale)
    const timeEl = page.locator("time");
    await expect(timeEl).toBeVisible();
    // pt-BR date format contains "/" separators (e.g. "16/04/2026")
    await expect(timeEl).toContainText("/");
  });

  test("shows order items with name, quantity and prices in BRL", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "items");
    const category = await createCategory(request, restaurant.slug);
    const item1 = await createItem(request, restaurant.slug, category.id, {
      name: "Pizza Margherita",
      priceInCents: 3500,
      sortOrder: 1,
    });
    const item2 = await createItem(request, restaurant.slug, category.id, {
      name: "Coca-Cola",
      priceInCents: 800,
      sortOrder: 2,
    });

    await placeOrder(page, request, restaurant.slug, [
      { id: item1.id, name: item1.name, priceInCents: item1.priceInCents, quantity: 2 },
      { id: item2.id, name: item2.name, priceInCents: item2.priceInCents, quantity: 3 },
    ]);

    // Items with quantities
    await expect(page.getByText(/Pizza Margherita\s*×\s*2/)).toBeVisible();
    await expect(page.getByText(/Coca-Cola\s*×\s*3/)).toBeVisible();

    // Prices in BRL format (R$ X,XX)
    await expect(page.getByText("R$ 35,00").first()).toBeVisible();
    await expect(page.getByText("R$ 8,00").first()).toBeVisible();

    // Total: 2×3500 + 3×800 = 7000 + 2400 = 9400 cents = R$ 94,00
    await expect(page.getByText("R$ 94,00")).toBeVisible();

    // Total label
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("progress tracker shows all 6 steps in Portuguese after placing order", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "tracker");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Frango Grelhado",
      priceInCents: 2000,
      sortOrder: 1,
    });

    await placeOrder(page, request, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    // Wait for the deferred init of the polling component
    await page.waitForSelector('[data-testid="progress-tracker"]');

    // All 6 steps should be visible
    await expect(page.getByText("Pedido Criado")).toBeVisible();
    await expect(page.getByText("Pagamento Pendente")).toBeVisible();
    await expect(page.getByText("Pagamento Aprovado")).toBeVisible();
    await expect(page.getByText("Preparando")).toBeVisible();
    await expect(page.getByText("Pronto")).toBeVisible();
    await expect(page.getByText("Retirado")).toBeVisible();
  });

  test("progress tracker highlights current step (CREATED) and dims future steps", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "highlight");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Misto Quente",
      priceInCents: 1200,
      sortOrder: 1,
    });

    await placeOrder(page, request, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    await page.waitForSelector('[data-testid="progress-tracker"]');

    // CREATED step (index 0) should be dark/bold (active)
    const createdStep = page.locator('[data-testid="step-CREATED"]');
    await expect(createdStep).toBeVisible();
    await expect(createdStep).toHaveClass(/text-zinc-900/);
    const createdSpan = createdStep.locator("span");
    await expect(createdSpan).toHaveClass(/font-bold/);

    // PAYMENT_PENDING step (index 1) should be dimmed (future)
    const paymentPendingStep = page.locator('[data-testid="step-PAYMENT_PENDING"]');
    await expect(paymentPendingStep).toBeVisible();
    await expect(paymentPendingStep).toHaveClass(/text-zinc-400/);
    const paymentPendingSpan = paymentPendingStep.locator("span");
    await expect(paymentPendingSpan).toHaveClass(/font-normal/);

    // PAYMENT_APPROVED step (future) should be dimmed
    const paymentApprovedStep = page.locator('[data-testid="step-PAYMENT_APPROVED"]');
    await expect(paymentApprovedStep).toHaveClass(/text-zinc-400/);

    // PREPARING step (future) should be dimmed
    const preparingStep = page.locator('[data-testid="step-PREPARING"]');
    await expect(preparingStep).toHaveClass(/text-zinc-400/);

    // READY step (future) should be dimmed
    const readyStep = page.locator('[data-testid="step-READY"]');
    await expect(readyStep).toHaveClass(/text-zinc-400/);

    // PICKED_UP step (future) should be dimmed
    const pickedUpStep = page.locator('[data-testid="step-PICKED_UP"]');
    await expect(pickedUpStep).toHaveClass(/text-zinc-400/);
  });

  test("CANCELLED status shows 'Pedido Cancelado' banner instead of progress tracker", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "cancel");
    const category = await createCategory(request, restaurant.slug);
    const item = await createItem(request, restaurant.slug, category.id, {
      name: "Suco Natural",
      priceInCents: 900,
      sortOrder: 1,
    });

    const orderId = await placeOrder(page, request, restaurant.slug, [
      { id: item.id, name: item.name, priceInCents: item.priceInCents, quantity: 1 },
    ]);

    // Cancel the order via the API (CREATED → CANCELLED is a valid transition)
    const patchRes = await request.patch(
      `/api/restaurants/${restaurant.slug}/orders/${orderId}`,
      { data: { status: "CANCELLED" } }
    );
    expect(patchRes.status()).toBe(200);

    // Reload the page to get the updated status
    await page.reload();

    // Wait for the deferred init
    await page.waitForSelector('[data-testid="cancelled-state"]');

    // Should show the cancelled banner
    await expect(
      page.locator('[data-testid="cancelled-state"]')
    ).toBeVisible();
    await expect(page.getByText("Pedido Cancelado")).toBeVisible();

    // The regular progress tracker should NOT be present
    await expect(
      page.locator('[data-testid="progress-tracker"]')
    ).not.toBeVisible();
  });

  test("404 page is shown when orderId does not exist", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "404");

    // Navigate to a non-existent orderId
    await page.goto(
      `/${restaurant.slug}/pedido/nonexistent-order-id-that-does-not-exist`
    );

    // Next.js should show a 404 response
    await expect(page).toHaveURL(
      new RegExp(
        `/${restaurant.slug}/pedido/nonexistent-order-id-that-does-not-exist`
      )
    );
    // Next.js 404 pages typically contain "404" or "not found" text
    await expect(
      page.getByText(/404|not found|página não encontrada/i)
    ).toBeVisible();
  });

  test("full checkout-to-status-page flow: all order info displays correctly", async ({
    page,
    request,
  }) => {
    const restaurant = await createRestaurant(request, "fullflow");
    const category = await createCategory(request, restaurant.slug);
    const item1 = await createItem(request, restaurant.slug, category.id, {
      name: "Pastel de Frango",
      priceInCents: 1800,
      sortOrder: 1,
    });
    const item2 = await createItem(request, restaurant.slug, category.id, {
      name: "Suco de Uva",
      priceInCents: 700,
      sortOrder: 2,
    });

    await placeOrder(
      page,
      request,
      restaurant.slug,
      [
        { id: item1.id, name: item1.name, priceInCents: item1.priceInCents, quantity: 2 },
        { id: item2.id, name: item2.name, priceInCents: item2.priceInCents, quantity: 1 },
      ],
      "Fernanda Lima",
      "31987654321"
    );

    // Should be on order status page
    await expect(page).toHaveURL(new RegExp(`/${restaurant.slug}/pedido/`));

    // Order number heading
    await expect(
      page.getByRole("heading", { name: /Pedido #\d+/ })
    ).toBeVisible();

    // Customer name
    await expect(page.getByText("Fernanda Lima")).toBeVisible();

    // Formatted date/time in pt-BR
    const timeEl = page.locator("time");
    await expect(timeEl).toBeVisible();
    await expect(timeEl).toContainText("/");

    // Items with quantities
    await expect(page.getByText(/Pastel de Frango\s*×\s*2/)).toBeVisible();
    await expect(page.getByText(/Suco de Uva\s*×\s*1/)).toBeVisible();

    // Prices in BRL format
    // Pastel de Frango: R$ 18,00
    await expect(page.getByText("R$ 18,00").first()).toBeVisible();
    // Suco de Uva: R$ 7,00
    await expect(page.getByText("R$ 7,00").first()).toBeVisible();

    // Total: 2×1800 + 1×700 = 3600 + 700 = 4300 cents = R$ 43,00
    await expect(page.getByText("R$ 43,00")).toBeVisible();

    // Progress tracker should be visible after deferred init
    await page.waitForSelector('[data-testid="progress-tracker"]');
    await expect(
      page.locator('[data-testid="progress-tracker"]')
    ).toBeVisible();
  });
});
