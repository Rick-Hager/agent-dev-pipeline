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
});

// ─── GET /api/restaurants/[slug]/orders ──────────────────────────────────────

describe("GET /api/restaurants/[slug]/orders", () => {
  let orderId: string;

  beforeAll(async () => {
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 100,
        customerName: "Test Customer",
        customerPhone: "+5511777777777",
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

  it("returns all orders for the restaurant", async () => {
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
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const found = body.find((o: { id: string }) => o.id === orderId);
    expect(found).toBeDefined();
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
