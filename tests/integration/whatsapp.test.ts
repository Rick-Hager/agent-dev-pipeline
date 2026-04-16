import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

// ─── Mock the whatsapp module ─────────────────────────────────────────────────

vi.mock("@/lib/whatsapp", () => ({
  sendOrderNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const TEST_SLUG = "whatsapp-notification-test-restaurant";
let restaurantId: string;
let menuItemId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "WhatsApp Test Restaurant",
      slug: TEST_SLUG,
      email: "whatsapp-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
      whatsappNumber: "+15550000001",
      whatsappApiConfig: { accountSid: "ACtest", authToken: "token123" },
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
      name: "Test Burger",
      priceInCents: 1500,
      isAvailable: true,
    },
  });
  menuItemId = menuItem.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({ where: { slug: TEST_SLUG } });
});

// ─── PATCH status update triggers WhatsApp notification ──────────────────────

describe("PATCH /api/restaurants/[slug]/orders/[orderId] — WhatsApp integration", () => {
  let orderId: string;

  beforeEach(async () => {
    // Create a fresh order starting at PAYMENT_PENDING for each test
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: Math.floor(Math.random() * 900000) + 100000,
        customerName: "WhatsApp Test Customer",
        customerPhone: "+5511999999999",
        totalInCents: 1500,
        status: OrderStatus.PAYMENT_PENDING,
        items: {
          create: [
            {
              menuItemId,
              name: "Test Burger",
              priceInCents: 1500,
              quantity: 1,
            },
          ],
        },
      },
    });
    orderId = order.id;

    // Reset mock before each test
    const { sendOrderNotification } = await import("@/lib/whatsapp");
    vi.mocked(sendOrderNotification).mockClear();
    vi.mocked(sendOrderNotification).mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
  });

  it("calls sendOrderNotification after status transitions to PAYMENT_APPROVED", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: OrderStatus.PAYMENT_APPROVED }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(OrderStatus.PAYMENT_APPROVED);
    expect(vi.mocked(sendOrderNotification)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendOrderNotification).mock.calls[0][0]).toMatchObject({
      status: OrderStatus.PAYMENT_APPROVED,
    });
  });

  it("returns 200 and updated order even when sendOrderNotification rejects", async () => {
    const { PATCH } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/route"
    );
    const { sendOrderNotification } = await import("@/lib/whatsapp");

    vi.mocked(sendOrderNotification).mockRejectedValueOnce(
      new Error("WhatsApp down")
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: OrderStatus.PAYMENT_APPROVED }),
      }
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(OrderStatus.PAYMENT_APPROVED);
  });
});
