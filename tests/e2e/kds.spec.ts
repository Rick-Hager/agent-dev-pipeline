import { test, expect, type APIRequestContext } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ts = Date.now();
const KDS_SLUG = `e2e-kds-${ts}`;

async function createRestaurant(request: APIRequestContext): Promise<{ id: string; slug: string }> {
  const res = await request.post("/api/restaurants", {
    data: {
      name: "E2E KDS Restaurant",
      slug: KDS_SLUG,
      email: `e2e-kds-${ts}@test.com`,
      password: "secret123",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.id as string, slug: KDS_SLUG };
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

async function createMenuItem(
  request: APIRequestContext,
  slug: string,
  categoryId: string
): Promise<{ id: string; name: string; priceInCents: number }> {
  const res = await request.post(
    `/api/restaurants/${slug}/categories/${categoryId}/items`,
    {
      data: {
        name: "Hambúrguer",
        priceInCents: 2500,
        sortOrder: 1,
      },
    }
  );
  expect(res.status()).toBe(201);
  return res.json();
}

async function createOrder(
  request: APIRequestContext,
  slug: string,
  menuItemId: string,
  customerName: string,
  targetStatus: string
): Promise<{ id: string; orderNumber: number }> {
  // Create order (starts as CREATED)
  const res = await request.post(`/api/restaurants/${slug}/orders`, {
    data: {
      customerName,
      customerPhone: "11987654321",
      items: [{ menuItemId, quantity: 1 }],
    },
  });
  expect(res.status()).toBe(201);
  const order = await res.json();

  // Advance through statuses to reach the target
  const statusChain = [
    "CREATED",
    "PAYMENT_PENDING",
    "PAYMENT_APPROVED",
    "PREPARING",
    "READY",
    "PICKED_UP",
  ];
  const fromIdx = statusChain.indexOf("CREATED");
  const toIdx = statusChain.indexOf(targetStatus);

  for (let i = fromIdx + 1; i <= toIdx; i++) {
    const patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${order.id}`,
      { data: { status: statusChain[i] } }
    );
    expect(patchRes.status()).toBe(200);
  }

  return { id: order.id as string, orderNumber: order.orderNumber as number };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

test.describe("KDS — Kitchen Display System", () => {
  let slug: string;
  let menuItemId: string;

  test.beforeAll(async ({ request }) => {
    const restaurant = await createRestaurant(request);
    slug = restaurant.slug;
    const category = await createCategory(request, slug);
    const menuItem = await createMenuItem(request, slug, category.id);
    menuItemId = menuItem.id;
  });

  // ─── AC1: KDS page shows active orders ───────────────────────────────────

  test("AC1: KDS page shows active orders (PAYMENT_APPROVED, PREPARING, READY) for the restaurant", async ({
    page,
    request,
  }) => {
    // Create one order for each active KDS status
    const orderApproved = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Aprovado",
      "PAYMENT_APPROVED"
    );
    const orderPreparing = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Preparando",
      "PREPARING"
    );
    const orderReady = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Pronto",
      "READY"
    );

    await page.goto(`/${slug}/kds`);

    // All three customers should be visible on the page
    await expect(page.getByText("Cliente Aprovado")).toBeVisible();
    await expect(page.getByText("Cliente Preparando")).toBeVisible();
    await expect(page.getByText("Cliente Pronto")).toBeVisible();

    // Clean up: advance orders out of KDS view
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "PREPARING" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "PICKED_UP" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderPreparing.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderPreparing.id}`, {
      data: { status: "PICKED_UP" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderReady.id}`, {
      data: { status: "PICKED_UP" },
    });
  });

  // ─── AC2: Orders are displayed in correct kanban columns ─────────────────

  test("AC2: Orders displayed in kanban columns — Novos, Preparando, Prontos", async ({
    page,
    request,
  }) => {
    const orderApproved = await createOrder(
      request,
      slug,
      menuItemId,
      "Novo Cliente",
      "PAYMENT_APPROVED"
    );
    const orderPreparing = await createOrder(
      request,
      slug,
      menuItemId,
      "Em Preparo",
      "PREPARING"
    );
    const orderReady = await createOrder(
      request,
      slug,
      menuItemId,
      "Pedido Pronto",
      "READY"
    );

    await page.goto(`/${slug}/kds`);

    // Column headings should be present
    await expect(page.getByRole("heading", { name: "Novos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preparando" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prontos" })).toBeVisible();

    // Each order should appear under the correct column
    // Locate each column section by heading
    const novosSection = page.locator("section").filter({ hasText: "Novos" }).first();
    const preparandoSection = page.locator("section").filter({ hasText: "Preparando" }).first();
    const prontosSection = page.locator("section").filter({ hasText: "Prontos" }).first();

    await expect(novosSection.getByText("Novo Cliente")).toBeVisible();
    await expect(preparandoSection.getByText("Em Preparo")).toBeVisible();
    await expect(prontosSection.getByText("Pedido Pronto")).toBeVisible();

    // Clean up
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "PREPARING" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderApproved.id}`, {
      data: { status: "PICKED_UP" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderPreparing.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderPreparing.id}`, {
      data: { status: "PICKED_UP" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${orderReady.id}`, {
      data: { status: "PICKED_UP" },
    });
  });

  // ─── AC3: Order card shows order number, customer name, items, elapsed time ─

  test("AC3: Each order card shows order number, customer name, items with quantities, and elapsed time", async ({
    page,
    request,
  }) => {
    const order = await createOrder(
      request,
      slug,
      menuItemId,
      "Ana Cardinfo",
      "PAYMENT_APPROVED"
    );

    await page.goto(`/${slug}/kds`);

    // Order number (large) — the card renders #orderNumber
    await expect(
      page.getByText(`#${order.orderNumber}`)
    ).toBeVisible();

    // Customer name
    await expect(page.getByText("Ana Cardinfo")).toBeVisible();

    // Item with quantity (rendered as "1x Hambúrguer")
    await expect(page.getByText(/1x Hambúrguer/)).toBeVisible();

    // Elapsed time — either "Agora" or "X min atrás"
    await expect(
      page.getByText(/Agora|min atrás/)
    ).toBeVisible();

    // Clean up
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "PREPARING" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "PICKED_UP" },
    });
  });

  // ─── AC4: "Iniciar" button moves PAYMENT_APPROVED → PREPARING ────────────

  test("AC4: 'Iniciar' button moves order from Novos (PAYMENT_APPROVED) to Preparando (PREPARING)", async ({
    page,
    request,
  }) => {
    const order = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Iniciar",
      "PAYMENT_APPROVED"
    );

    await page.goto(`/${slug}/kds`);

    // The order card should appear in the Novos column with an "Iniciar" button
    const novosSection = page.locator("section").filter({ hasText: "Novos" }).first();
    const card = novosSection.locator("article").filter({ hasText: "Cliente Iniciar" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Iniciar" })).toBeVisible();

    // Click the button
    await card.getByRole("button", { name: "Iniciar" }).click();

    // After the action, the order should disappear from Novos
    await expect(novosSection.getByText("Cliente Iniciar")).not.toBeVisible();

    // And appear in Preparando
    const preparandoSection = page
      .locator("section")
      .filter({ hasText: "Preparando" })
      .first();
    await expect(preparandoSection.getByText("Cliente Iniciar")).toBeVisible();

    // Clean up
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "READY" },
    });
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "PICKED_UP" },
    });
  });

  // ─── AC5: "Pronto" button moves PREPARING → READY ─────────────────────────

  test("AC5: 'Pronto' button moves order from Preparando (PREPARING) to Prontos (READY)", async ({
    page,
    request,
  }) => {
    const order = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Pronto",
      "PREPARING"
    );

    await page.goto(`/${slug}/kds`);

    // The order card should appear in Preparando with a "Pronto" button
    const preparandoSection = page
      .locator("section")
      .filter({ hasText: "Preparando" })
      .first();
    const card = preparandoSection.locator("article").filter({ hasText: "Cliente Pronto" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Pronto" })).toBeVisible();

    // Click the button
    await card.getByRole("button", { name: "Pronto" }).click();

    // After the action, the order should disappear from Preparando
    await expect(preparandoSection.getByText("Cliente Pronto")).not.toBeVisible();

    // And appear in Prontos
    const prontosSection = page
      .locator("section")
      .filter({ hasText: "Prontos" })
      .first();
    await expect(prontosSection.getByText("Cliente Pronto")).toBeVisible();

    // Clean up
    await request.patch(`/api/restaurants/${slug}/orders/${order.id}`, {
      data: { status: "PICKED_UP" },
    });
  });

  // ─── AC6: "Entregar" button moves READY → PICKED_UP (disappears) ─────────

  test("AC6: 'Entregar' button moves order from Prontos (READY) to PICKED_UP — disappears from KDS", async ({
    page,
    request,
  }) => {
    const order = await createOrder(
      request,
      slug,
      menuItemId,
      "Cliente Entregar",
      "READY"
    );

    await page.goto(`/${slug}/kds`);

    // The order card should appear in Prontos with an "Entregar" button
    const prontosSection = page
      .locator("section")
      .filter({ hasText: "Prontos" })
      .first();
    const card = prontosSection.locator("article").filter({ hasText: "Cliente Entregar" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Entregar" })).toBeVisible();

    // Click the button
    await card.getByRole("button", { name: "Entregar" }).click();

    // After the action, the order should disappear from Prontos entirely
    await expect(prontosSection.getByText("Cliente Entregar")).not.toBeVisible();

    // And must NOT appear in any other column either
    await expect(page.getByText("Cliente Entregar")).not.toBeVisible();
  });

  // ─── AC7: Non-active statuses do NOT appear on KDS ───────────────────────

  test("AC7: Orders with CREATED, PAYMENT_PENDING, PICKED_UP, or CANCELLED do NOT appear on the KDS", async ({
    page,
    request,
  }) => {
    // Create orders with non-active statuses

    // CREATED status (no advancement needed)
    const resCreated = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Invisivel CREATED",
        customerPhone: "11987654321",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(resCreated.status()).toBe(201);
    const orderCreated = await resCreated.json();

    // PAYMENT_PENDING status
    const resPending = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Invisivel PENDING",
        customerPhone: "11987654321",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(resPending.status()).toBe(201);
    const orderPending = await resPending.json();
    await request.patch(`/api/restaurants/${slug}/orders/${orderPending.id}`, {
      data: { status: "PAYMENT_PENDING" },
    });

    // CANCELLED status
    const resCancelled = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Invisivel CANCELLED",
        customerPhone: "11987654321",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(resCancelled.status()).toBe(201);
    const orderCancelled = await resCancelled.json();
    await request.patch(`/api/restaurants/${slug}/orders/${orderCancelled.id}`, {
      data: { status: "CANCELLED" },
    });

    // PICKED_UP status (advance all the way through)
    const orderPickedUp = await createOrder(
      request,
      slug,
      menuItemId,
      "Invisivel PICKED_UP",
      "PICKED_UP"
    );

    await page.goto(`/${slug}/kds`);

    // None of these should appear on the KDS page
    await expect(page.getByText("Invisivel CREATED")).not.toBeVisible();
    await expect(page.getByText("Invisivel PENDING")).not.toBeVisible();
    await expect(page.getByText("Invisivel CANCELLED")).not.toBeVisible();
    await expect(page.getByText("Invisivel PICKED_UP")).not.toBeVisible();

    // Suppress unused variable warning
    void orderPickedUp;
  });
});
