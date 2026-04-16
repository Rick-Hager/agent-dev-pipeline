// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

const TEST_SLUG = "stats-api-test-restaurant";
const OTHER_SLUG = "stats-api-other-restaurant";

let restaurantId: string;
let otherRestaurantId: string;
let menuItemId: string;
let authToken: string;

async function makeRequest(
  slug: string,
  cookieHeader?: string
): Promise<Response> {
  const { GET } = await import("@/app/api/restaurants/[slug]/stats/route");
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers["cookie"] = cookieHeader;
  }
  const request = new NextRequest(
    `http://localhost:3000/api/restaurants/${slug}/stats`,
    { headers }
  );
  return GET(request, { params: Promise.resolve({ slug }) });
}

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";

  // Clean up any leftovers from prior runs
  const existing = await prisma.restaurant.findUnique({ where: { slug: TEST_SLUG } });
  if (existing) {
    await prisma.order.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurant.delete({ where: { slug: TEST_SLUG } });
  }
  const existingOther = await prisma.restaurant.findUnique({ where: { slug: OTHER_SLUG } });
  if (existingOther) {
    await prisma.order.deleteMany({ where: { restaurantId: existingOther.id } });
    await prisma.restaurant.delete({ where: { slug: OTHER_SLUG } });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Stats API Test Restaurant",
      slug: TEST_SLUG,
      email: "stats-api-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantId = restaurant.id;

  const other = await prisma.restaurant.create({
    data: {
      name: "Stats API Other Restaurant",
      slug: OTHER_SLUG,
      email: "stats-api-other@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  otherRestaurantId = other.id;

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
      name: "Burger",
      priceInCents: 2000,
      isAvailable: true,
    },
  });
  menuItemId = menuItem.id;

  authToken = await signJwt({
    restaurantId,
    slug: TEST_SLUG,
    email: "stats-api-test@integration-test.com",
  });

  // Today's orders:
  // CREATED (excluded from ordersToday and revenueToday)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 1,
      customerName: "Customer 1",
      customerPhone: "+5511111111111",
      totalInCents: 2000,
      status: OrderStatus.CREATED,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 1 }] },
    },
  });

  // PAYMENT_PENDING (excluded)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 2,
      customerName: "Customer 2",
      customerPhone: "+5511111111112",
      totalInCents: 2000,
      status: OrderStatus.PAYMENT_PENDING,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 1 }] },
    },
  });

  // PAYMENT_APPROVED (included in ordersToday + revenueToday, NOT activeOrders)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 3,
      customerName: "Customer 3",
      customerPhone: "+5511111111113",
      totalInCents: 4000,
      status: OrderStatus.PAYMENT_APPROVED,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 2 }] },
    },
  });

  // PREPARING (included in ordersToday + revenueToday + activeOrders)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 4,
      customerName: "Customer 4",
      customerPhone: "+5511111111114",
      totalInCents: 2000,
      status: OrderStatus.PREPARING,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 1 }] },
    },
  });

  // READY (included in ordersToday + revenueToday + activeOrders)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 5,
      customerName: "Customer 5",
      customerPhone: "+5511111111115",
      totalInCents: 6000,
      status: OrderStatus.READY,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 3 }] },
    },
  });

  // PICKED_UP (included in ordersToday + revenueToday, NOT activeOrders)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 6,
      customerName: "Customer 6",
      customerPhone: "+5511111111116",
      totalInCents: 2000,
      status: OrderStatus.PICKED_UP,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 1 }] },
    },
  });

  // CANCELLED (excluded)
  await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: 7,
      customerName: "Customer 7",
      customerPhone: "+5511111111117",
      totalInCents: 2000,
      status: OrderStatus.CANCELLED,
      items: { create: [{ menuItemId, name: "Burger", priceInCents: 2000, quantity: 1 }] },
    },
  });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { restaurantId } });
  await prisma.order.deleteMany({ where: { restaurantId: otherRestaurantId } });
  await prisma.restaurant.deleteMany({ where: { slug: { in: [TEST_SLUG, OTHER_SLUG] } } });
});

describe("GET /api/restaurants/[slug]/stats", () => {
  it("returns 401 when no auth token is provided", async () => {
    const response = await makeRequest(TEST_SLUG);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("returns 403 when slug does not match the authenticated restaurant", async () => {
    const response = await makeRequest(OTHER_SLUG, `${COOKIE_NAME}=${authToken}`);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  it("returns correct counts and revenue for orders in various statuses", async () => {
    const response = await makeRequest(TEST_SLUG, `${COOKIE_NAME}=${authToken}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slug).toBe(TEST_SLUG);
    // PAYMENT_APPROVED + PREPARING + READY + PICKED_UP = 4 orders
    expect(body.ordersToday).toBe(4);
    // 4000 + 2000 + 6000 + 2000 = 14000
    expect(body.revenueToday).toBe(14000);
    // PREPARING + READY = 2 active orders
    expect(body.activeOrders).toBe(2);
  });

  it("revenue only includes PAYMENT_APPROVED and above orders (not CREATED or PAYMENT_PENDING)", async () => {
    const response = await makeRequest(TEST_SLUG, `${COOKIE_NAME}=${authToken}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    // CREATED (2000) and PAYMENT_PENDING (2000) should be excluded
    // If they were included: 2000 + 2000 + 4000 + 2000 + 6000 + 2000 = 18000
    // Correct value excluding CREATED and PAYMENT_PENDING: 14000
    expect(body.revenueToday).toBe(14000);
    expect(body.ordersToday).toBe(4);
  });

  it("activeOrders only includes PREPARING and READY statuses", async () => {
    const response = await makeRequest(TEST_SLUG, `${COOKIE_NAME}=${authToken}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Only PREPARING (1) + READY (1) = 2
    expect(body.activeOrders).toBe(2);
  });

  it("returns correct response shape", async () => {
    const response = await makeRequest(TEST_SLUG, `${COOKIE_NAME}=${authToken}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("slug");
    expect(body).toHaveProperty("ordersToday");
    expect(body).toHaveProperty("revenueToday");
    expect(body).toHaveProperty("activeOrders");
    expect(typeof body.ordersToday).toBe("number");
    expect(typeof body.revenueToday).toBe("number");
    expect(typeof body.activeOrders).toBe("number");
  });
});
