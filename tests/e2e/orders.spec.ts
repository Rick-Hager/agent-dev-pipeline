import { test, expect, type APIRequestContext } from "@playwright/test";

const ts = Date.now();
const TEST_SLUG = `e2e-orders-${ts}`;

// Helper: create a restaurant via API and return { slug, id }
async function createRestaurant(request: APIRequestContext) {
  const res = await request.post("/api/restaurants", {
    data: {
      name: "E2E Orders Test Restaurant",
      slug: TEST_SLUG,
      email: `e2e-orders-${ts}@test.com`,
      password: "secret123",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body as { id: string; slug: string };
}

// Helper: create a category via API
async function createCategory(request: APIRequestContext, slug: string) {
  const res = await request.post(`/api/restaurants/${slug}/categories`, {
    data: { name: "Mains", sortOrder: 0 },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body as { id: string };
}

// Helper: create a menu item via API
async function createMenuItem(
  request: APIRequestContext,
  slug: string,
  categoryId: string,
  data: {
    name: string;
    priceInCents: number;
    isAvailable?: boolean;
  }
) {
  const res = await request.post(
    `/api/restaurants/${slug}/categories/${categoryId}/items`,
    { data }
  );
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body as { id: string; name: string; priceInCents: number };
}

test.describe("Order API E2E", () => {
  let slug: string;
  let categoryId: string;
  let menuItemId: string;
  let unavailableItemId: string;

  test.beforeAll(async ({ request }) => {
    const restaurant = await createRestaurant(request);
    slug = restaurant.slug;

    const category = await createCategory(request, slug);
    categoryId = category.id;

    const menuItem = await createMenuItem(request, slug, categoryId, {
      name: "Burger",
      priceInCents: 1500,
    });
    menuItemId = menuItem.id;

    // Create an unavailable menu item: create it then soft-delete (sets isAvailable: false)
    const unavailableItem = await createMenuItem(request, slug, categoryId, {
      name: "Unavailable Item",
      priceInCents: 800,
    });
    unavailableItemId = unavailableItem.id;

    // Soft-delete it to set isAvailable: false
    const deleteRes = await request.delete(
      `/api/restaurants/${slug}/categories/${categoryId}/items/${unavailableItemId}`
    );
    expect(deleteRes.status()).toBe(200);
  });

  // ─── POST /api/restaurants/[slug]/orders ─────────────────────────────────────

  test("POST /api/restaurants/[slug]/orders — happy path: returns 201 with correct shape", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "John Doe",
        customerPhone: "+5511999999999",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 2 }],
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.orderNumber).toBeDefined();
    expect(typeof body.orderNumber).toBe("number");
    expect(body.orderNumber).toBeGreaterThan(0);
    expect(body.totalInCents).toBe(3000); // 1500 * 2
    expect(body.status).toBe("CREATED");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Burger");
    expect(body.items[0].priceInCents).toBe(1500);
    expect(body.items[0].quantity).toBe(2);
  });

  test("POST /api/restaurants/[slug]/orders — second order increments orderNumber", async ({
    request,
  }) => {
    // Use a separate slug so we can control sequence cleanly
    const seqSlug = `e2e-orders-seq-${ts}`;
    const seqRestaurantRes = await request.post("/api/restaurants", {
      data: {
        name: "E2E Seq Restaurant",
        slug: seqSlug,
        email: `e2e-orders-seq-${ts}@test.com`,
        password: "secret123",
      },
    });
    expect(seqRestaurantRes.status()).toBe(201);

    const seqCatRes = await request.post(
      `/api/restaurants/${seqSlug}/categories`,
      { data: { name: "Mains", sortOrder: 0 } }
    );
    expect(seqCatRes.status()).toBe(201);
    const seqCategory = await seqCatRes.json();

    const seqItemRes = await request.post(
      `/api/restaurants/${seqSlug}/categories/${seqCategory.id}/items`,
      { data: { name: "Pizza", priceInCents: 2000 } }
    );
    expect(seqItemRes.status()).toBe(201);
    const seqItem = await seqItemRes.json();

    const orderData = {
      customerName: "Alice",
      customerPhone: "+5511111111111",
      customerEmail: "e2e@test.com",
      items: [{ menuItemId: seqItem.id, quantity: 1 }],
    };

    const firstRes = await request.post(
      `/api/restaurants/${seqSlug}/orders`,
      { data: orderData }
    );
    expect(firstRes.status()).toBe(201);
    const firstOrder = await firstRes.json();

    const secondRes = await request.post(
      `/api/restaurants/${seqSlug}/orders`,
      { data: orderData }
    );
    expect(secondRes.status()).toBe(201);
    const secondOrder = await secondRes.json();

    expect(secondOrder.orderNumber).toBe(firstOrder.orderNumber + 1);
  });

  test("POST /api/restaurants/[slug]/orders — snapshots item name and price at time of order", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Snapshot Test",
        customerPhone: "+5511888888888",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 1 }],
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    const item = body.items[0];

    // Verify snapshot fields match the MenuItem values at creation time
    expect(item.name).toBe("Burger");
    expect(item.priceInCents).toBe(1500);
    expect(item.menuItemId).toBe(menuItemId);
    expect(item.quantity).toBe(1);
  });

  test("POST /api/restaurants/[slug]/orders — missing customerName returns 400", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerPhone: "+5511999999999",
        items: [{ menuItemId, quantity: 1 }],
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/orders — missing customerPhone returns 400", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "John Doe",
        items: [{ menuItemId, quantity: 1 }],
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/orders — empty items array returns 400", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "John Doe",
        customerPhone: "+5511999999999",
        items: [],
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/orders — invalid menuItemId returns 400", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "John Doe",
        customerPhone: "+5511999999999",
        items: [{ menuItemId: "nonexistent-item-id-xyz", quantity: 1 }],
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("POST /api/restaurants/[slug]/orders — unavailable menu item returns 400", async ({
    request,
  }) => {
    const res = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "John Doe",
        customerPhone: "+5511999999999",
        items: [{ menuItemId: unavailableItemId, quantity: 1 }],
      },
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ─── GET /api/restaurants/[slug]/orders/[orderId] ────────────────────────────

  test("GET /api/restaurants/[slug]/orders/[orderId] — returns full order with items", async ({
    request,
  }) => {
    // First create an order
    const createRes = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Get Test Customer",
        customerPhone: "+5511777777777",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 2 }],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Now retrieve it
    const getRes = await request.get(
      `/api/restaurants/${slug}/orders/${created.id}`
    );
    expect(getRes.status()).toBe(200);

    const body = await getRes.json();
    expect(body.id).toBe(created.id);
    expect(body.orderNumber).toBe(created.orderNumber);
    expect(body.totalInCents).toBe(3000);
    expect(body.status).toBe("CREATED");
    expect(body.customerName).toBe("Get Test Customer");
    expect(body.customerPhone).toBe("+5511777777777");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Burger");
    expect(body.items[0].priceInCents).toBe(1500);
    expect(body.items[0].quantity).toBe(2);
  });

  test("GET /api/restaurants/[slug]/orders/[orderId] — 404 for non-existent orderId", async ({
    request,
  }) => {
    const res = await request.get(
      `/api/restaurants/${slug}/orders/nonexistent-order-id-xyz`
    );

    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ─── PATCH status lifecycle ──────────────────────────────────────────────────

  test("PATCH status — full lifecycle: CREATED→PAYMENT_PENDING→PAYMENT_APPROVED→PREPARING→READY→PICKED_UP", async ({
    request,
  }) => {
    // Create order
    const createRes = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Lifecycle Customer",
        customerPhone: "+5511555555555",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(createRes.status()).toBe(201);
    const order = await createRes.json();
    const orderId = order.id as string;

    // CREATED → PAYMENT_PENDING
    let patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: "PAYMENT_PENDING" } }
    );
    expect(patchRes.status()).toBe(200);
    let body = await patchRes.json();
    expect(body.status).toBe("PAYMENT_PENDING");

    // PAYMENT_PENDING → PAYMENT_APPROVED
    patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: "PAYMENT_APPROVED" } }
    );
    expect(patchRes.status()).toBe(200);
    body = await patchRes.json();
    expect(body.status).toBe("PAYMENT_APPROVED");

    // PAYMENT_APPROVED → PREPARING
    patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: "PREPARING" } }
    );
    expect(patchRes.status()).toBe(200);
    body = await patchRes.json();
    expect(body.status).toBe("PREPARING");

    // PREPARING → READY
    patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: "READY" } }
    );
    expect(patchRes.status()).toBe(200);
    body = await patchRes.json();
    expect(body.status).toBe("READY");

    // READY → PICKED_UP
    patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${orderId}`,
      { data: { status: "PICKED_UP" } }
    );
    expect(patchRes.status()).toBe(200);
    body = await patchRes.json();
    expect(body.status).toBe("PICKED_UP");
  });

  test("PATCH status — CANCELLED from CREATED status", async ({ request }) => {
    // Create order
    const createRes = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Cancel Customer",
        customerPhone: "+5511444444444",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(createRes.status()).toBe(201);
    const order = await createRes.json();

    // Jump to CANCELLED directly from CREATED
    const patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${order.id}`,
      { data: { status: "CANCELLED" } }
    );
    expect(patchRes.status()).toBe(200);

    const body = await patchRes.json();
    expect(body.status).toBe("CANCELLED");
  });

  test("PATCH status — invalid transition returns 400 with currentStatus and attemptedStatus", async ({
    request,
  }) => {
    // Create order (starts at CREATED)
    const createRes = await request.post(`/api/restaurants/${slug}/orders`, {
      data: {
        customerName: "Invalid Transition Customer",
        customerPhone: "+5511333333333",
        customerEmail: "e2e@test.com",
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(createRes.status()).toBe(201);
    const order = await createRes.json();

    // Attempt invalid transition: CREATED → PICKED_UP
    const patchRes = await request.patch(
      `/api/restaurants/${slug}/orders/${order.id}`,
      { data: { status: "PICKED_UP" } }
    );
    expect(patchRes.status()).toBe(400);

    const body = await patchRes.json();
    expect(body.error).toBeDefined();
    expect(body.currentStatus).toBe("CREATED");
    expect(body.attemptedStatus).toBe("PICKED_UP");
  });
});
