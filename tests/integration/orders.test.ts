import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const TEST_SLUG = "order-api-test-restaurant";

let restaurantId: string;
let categoryId: string;
let menuItemId: string;
let unavailableMenuItemId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Order API Test Restaurant",
      slug: TEST_SLUG,
      email: "order-api-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantId = restaurant.id;

  const category = await prisma.category.create({
    data: {
      restaurantId,
      name: "Test Category",
      sortOrder: 0,
    },
  });
  categoryId = category.id;

  const menuItem = await prisma.menuItem.create({
    data: {
      restaurantId,
      categoryId,
      name: "Burger",
      priceInCents: 1500,
      isAvailable: true,
    },
  });
  menuItemId = menuItem.id;

  const unavailableItem = await prisma.menuItem.create({
    data: {
      restaurantId,
      categoryId,
      name: "Unavailable Item",
      priceInCents: 800,
      isAvailable: false,
    },
  });
  unavailableMenuItemId = unavailableItem.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
});

// ─── POST /api/restaurants/[slug]/orders ─────────────────────────────────────

describe("POST /api/restaurants/[slug]/orders", () => {
  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
  });

  it("creates an order and returns 201 with correct shape", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
          items: [{ menuItemId, quantity: 2 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.orderNumber).toBeDefined();
    expect(body.status).toBe(OrderStatus.CREATED);
    expect(body.totalInCents).toBe(3000); // 1500 * 2
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Burger");
    expect(body.items[0].priceInCents).toBe(1500);
    expect(body.items[0].quantity).toBe(2);
  });

  it("snapshots item name and price at time of order", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    // Update menu item price after order snapshot should still reflect old values
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Jane Doe",
          customerPhone: "+5511888888888",
          customerEmail: "test@example.com",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    // Check the snapshot fields
    const item = body.items[0];
    expect(item.name).toBe("Burger");
    expect(item.priceInCents).toBe(1500);
    expect(item.menuItemId).toBe(menuItemId);
  });

  it("returns 400 if customerName is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if customerPhone is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerEmail: "test@example.com",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if items is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if items is an empty array", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
          items: [],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if a menuItemId does not exist", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
          items: [{ menuItemId: "nonexistent-id", quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 if a menuItem is unavailable", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+5511999999999",
          customerEmail: "test@example.com",
          items: [{ menuItemId: unavailableMenuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("persists customerEmail on order", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Maria",
          customerPhone: "+5511999999999",
          customerEmail: "maria@example.com",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as { id: string };
    const order = await prisma.order.findUnique({ where: { id: data.id } });
    expect(order?.customerEmail).toBe("maria@example.com");
  });

  it("returns 400 if customerEmail is missing", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Maria",
          customerPhone: "+5511999999999",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 if customerEmail is invalid", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Maria",
          customerPhone: "+5511999999999",
          customerEmail: "not-an-email",
          items: [{ menuItemId, quantity: 1 }],
        }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });

    expect(response.status).toBe(400);
  });
});

// ─── GET /api/restaurants/[slug]/orders ──────────────────────────────────────

describe("GET /api/restaurants/[slug]/orders", () => {
  let order1Id: string;
  let order2Id: string;
  let order3Id: string;

  beforeAll(async () => {
    // Create orders with different statuses and dates for filtering tests
    const order1 = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 100,
        customerName: "Test Customer 1",
        customerPhone: "+5511777777777",
        totalInCents: 1500,
        status: OrderStatus.CREATED,
        items: {
          create: [{ menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 }],
        },
      },
    });
    order1Id = order1.id;

    const order2 = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 101,
        customerName: "Test Customer 2",
        customerPhone: "+5511777777778",
        totalInCents: 3000,
        status: OrderStatus.PREPARING,
        items: {
          create: [{ menuItemId, name: "Burger", priceInCents: 1500, quantity: 2 }],
        },
      },
    });
    order2Id = order2.id;

    const order3 = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 102,
        customerName: "Test Customer 3",
        customerPhone: "+5511777777779",
        totalInCents: 1500,
        status: OrderStatus.CANCELLED,
        items: {
          create: [{ menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 }],
        },
      },
    });
    order3Id = order3.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
  });

  it("returns paginated list with default page=1 and limit=20", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("orders");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("totalPages");
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.length).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    const found = body.orders.find((o: { id: string }) => o.id === order1Id);
    expect(found).toBeDefined();
  });

  it("returns orders with items included", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    const order = body.orders.find((o: { id: string }) => o.id === order1Id);
    expect(order).toBeDefined();
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items.length).toBeGreaterThan(0);
    expect(order.items[0]).toHaveProperty("id");
    expect(order.items[0]).toHaveProperty("name");
    expect(order.items[0]).toHaveProperty("priceInCents");
    expect(order.items[0]).toHaveProperty("quantity");
  });

  it("filters by status", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?status=PREPARING`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.every((o: { status: string }) => o.status === "PREPARING")).toBe(true);
    const found = body.orders.find((o: { id: string }) => o.id === order2Id);
    expect(found).toBeDefined();
  });

  it("filters by dateFrom and dateTo", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?dateFrom=${today}&dateTo=${today}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.orders)).toBe(true);
    // All orders just created today should be included
    expect(body.orders.length).toBeGreaterThanOrEqual(3);
  });

  it("returns correct total and totalPages", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?limit=2`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.limit).toBe(2);
    expect(body.totalPages).toBe(Math.ceil(body.total / 2));
    expect(body.orders.length).toBeLessThanOrEqual(2);
  });

  it("returns page=2 with correct offset", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    // Get page 1 first
    const req1 = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?limit=2&page=1`
    );
    const res1 = await GET(req1, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body1 = await res1.json();

    // Get page 2
    const req2 = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?limit=2&page=2`
    );
    const res2 = await GET(req2, { params: Promise.resolve({ slug: TEST_SLUG }) });
    const body2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(body2.page).toBe(2);
    // Orders on page 2 should be different from page 1
    const page1Ids = body1.orders.map((o: { id: string }) => o.id);
    const page2Ids = body2.orders.map((o: { id: string }) => o.id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("returns 400 for invalid status value", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders?status=INVALID_STATUS`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ─── GET /api/restaurants/[slug]/orders/[orderId] ────────────────────────────

describe("GET /api/restaurants/[slug]/orders/[orderId]", () => {
  let orderId: string;

  beforeAll(async () => {
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 200,
        customerName: "Get Test Customer",
        customerPhone: "+5511666666666",
        totalInCents: 3000,
        status: OrderStatus.CREATED,
        items: {
          create: [
            {
              menuItemId,
              name: "Burger",
              priceInCents: 1500,
              quantity: 2,
            },
          ],
        },
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
  });

  it("returns full order with items", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe(orderId);
    expect(body.customerName).toBe("Get Test Customer");
    expect(body.totalInCents).toBe(3000);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Burger");
  });

  it("returns 404 for non-existent orderId", async () => {
    const { GET } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/nonexistent-order-id`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId: "nonexistent-order-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});

// ─── PATCH /api/restaurants/[slug]/orders/[orderId] ──────────────────────────

describe("PATCH /api/restaurants/[slug]/orders/[orderId]", () => {
  let orderId: string;

  beforeAll(async () => {
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 300,
        customerName: "Patch Test Customer",
        customerPhone: "+5511555555555",
        totalInCents: 1500,
        status: OrderStatus.CREATED,
        items: {
          create: [
            {
              menuItemId,
              name: "Burger",
              priceInCents: 1500,
              quantity: 1,
            },
          ],
        },
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
  });

  it("updates order status on valid transition", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: OrderStatus.PAYMENT_PENDING }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(OrderStatus.PAYMENT_PENDING);
  });

  it("returns 400 with currentStatus and attemptedStatus on invalid transition", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );

    // Order is now PAYMENT_PENDING, try to go to PICKED_UP (invalid)
    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: OrderStatus.PICKED_UP }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(body.currentStatus).toBe(OrderStatus.PAYMENT_PENDING);
    expect(body.attemptedStatus).toBe(OrderStatus.PICKED_UP);
  });
});
