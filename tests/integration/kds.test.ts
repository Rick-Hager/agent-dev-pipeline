import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const TEST_SLUG = "kds-api-test-restaurant";

let restaurantId: string;
let menuItemId: string;

beforeAll(async () => {
  // Clean up any leftover data from previous runs
  const existing = await prisma.restaurant.findUnique({ where: { slug: TEST_SLUG } });
  if (existing) {
    await prisma.order.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurant.delete({ where: { slug: TEST_SLUG } });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "KDS API Test Restaurant",
      slug: TEST_SLUG,
      email: "kds-api-test@integration-test.com",
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

  const menuItem = await prisma.menuItem.create({
    data: {
      restaurantId,
      categoryId: category.id,
      name: "Pizza",
      priceInCents: 2000,
      isAvailable: true,
    },
  });
  menuItemId = menuItem.id;

  // Create orders with various statuses
  let orderNum = 1;
  for (const status of [
    OrderStatus.PAYMENT_APPROVED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.CREATED,
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.PICKED_UP,
    OrderStatus.CANCELLED,
  ]) {
    await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: orderNum++,
        customerName: `Customer ${status}`,
        customerPhone: "+5511999999999",
        totalInCents: 2000,
        status,
        items: {
          create: [
            {
              menuItemId,
              name: "Pizza",
              priceInCents: 2000,
              quantity: 1,
            },
          ],
        },
      },
    });
  }
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { restaurantId } });
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
});

describe("GET /api/restaurants/[slug]/kds", () => {
  it("returns only PAYMENT_APPROVED, PREPARING, and READY orders", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/kds`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders).toBeDefined();
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders).toHaveLength(3);

    const statuses = body.orders.map((o: { status: string }) => o.status);
    expect(statuses).toContain(OrderStatus.PAYMENT_APPROVED);
    expect(statuses).toContain(OrderStatus.PREPARING);
    expect(statuses).toContain(OrderStatus.READY);
  });

  it("excludes CREATED, PAYMENT_PENDING, PICKED_UP, and CANCELLED orders", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/kds`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);

    const statuses = body.orders.map((o: { status: string }) => o.status);
    expect(statuses).not.toContain(OrderStatus.CREATED);
    expect(statuses).not.toContain(OrderStatus.PAYMENT_PENDING);
    expect(statuses).not.toContain(OrderStatus.PICKED_UP);
    expect(statuses).not.toContain(OrderStatus.CANCELLED);
  });

  it("returns orders sorted by createdAt ascending (oldest first)", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/kds`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders.length).toBeGreaterThan(1);

    for (let i = 1; i < body.orders.length; i++) {
      const prev = new Date(body.orders[i - 1].createdAt).getTime();
      const curr = new Date(body.orders[i].createdAt).getTime();
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it("includes items in each order", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/kds`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders.length).toBeGreaterThan(0);

    for (const order of body.orders) {
      expect(Array.isArray(order.items)).toBe(true);
      expect(order.items.length).toBeGreaterThan(0);
      const item = order.items[0];
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.quantity).toBeDefined();
      expect(item.priceInCents).toBeDefined();
    }
  });

  it("returns correct response shape for each order", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/kds`
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: TEST_SLUG }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);

    for (const order of body.orders) {
      expect(order.id).toBeDefined();
      expect(order.orderNumber).toBeDefined();
      expect(order.customerName).toBeDefined();
      expect(order.status).toBeDefined();
      expect(order.createdAt).toBeDefined();
      expect(Array.isArray(order.items)).toBe(true);
    }
  });

  it("returns 404 for unknown slug", async () => {
    const { GET } = await import("@/app/api/restaurants/[slug]/kds/route");

    const request = new NextRequest(
      "http://localhost:3000/api/restaurants/unknown-restaurant-slug/kds"
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: "unknown-restaurant-slug" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });
});
