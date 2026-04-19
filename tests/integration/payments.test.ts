import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(public readonly options: { accessToken: string }) {}
  }
  class Payment {
    constructor(public readonly client: MercadoPagoConfig) {}
    get(args: unknown) {
      return paymentGetMock(args);
    }
  }
  return { MercadoPagoConfig, Payment };
});

const TEST_SLUG = "mp-payment-api-test-restaurant";

let restaurantId: string;
let menuItemId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "MP Payment API Test Restaurant",
      slug: TEST_SLUG,
      email: "mp-payment-api-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
      mercadopagoAccessToken: "APP_USR_test_token_123",
    },
  });
  restaurantId = restaurant.id;

  const category = await prisma.category.create({
    data: { restaurantId, name: "Test Category", sortOrder: 0 },
  });

  const item = await prisma.menuItem.create({
    data: {
      restaurantId,
      categoryId: category.id,
      name: "Burger",
      priceInCents: 1500,
      isAvailable: true,
    },
  });
  menuItemId = item.id;
});

afterAll(async () => {
  await prisma.restaurant.deleteMany({
    where: { slug: TEST_SLUG },
  });
});

describe("POST /api/webhooks/mercadopago", () => {
  let orderApprovedId: string;
  let orderRejectedId: string;
  let paymentApprovedId: string;
  let paymentRejectedId: string;

  beforeAll(async () => {
    paymentApprovedId = "1111111111";
    paymentRejectedId = "2222222222";

    const orderApproved = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 3000,
        customerName: "Webhook Approved",
        customerPhone: "+5511111111111",
        totalInCents: 1500,
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: "CARD",
        items: {
          create: [
            { menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 },
          ],
        },
      },
    });
    orderApprovedId = orderApproved.id;

    const orderRejected = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 3001,
        customerName: "Webhook Rejected",
        customerPhone: "+5511222222222",
        totalInCents: 1500,
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: "PIX",
        items: {
          create: [
            { menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 },
          ],
        },
      },
    });
    orderRejectedId = orderRejected.id;
  });

  beforeEach(() => {
    paymentGetMock.mockReset();
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { id: { in: [orderApprovedId, orderRejectedId] } },
    });
  });

  it("returns 200 and updates order to PAYMENT_APPROVED when MercadoPago payment is approved", async () => {
    paymentGetMock.mockResolvedValue({
      id: Number(paymentApprovedId),
      status: "approved",
      external_reference: orderApprovedId,
    });

    const { POST } = await import("@/app/api/webhooks/mercadopago/route");

    const request = new NextRequest(
      `http://localhost:3000/api/webhooks/mercadopago?type=payment&data.id=${paymentApprovedId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          data: { id: paymentApprovedId },
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await prisma.order.findUnique({
      where: { id: orderApprovedId },
    });
    expect(updated?.status).toBe(OrderStatus.PAYMENT_APPROVED);
    expect(updated?.mercadopagoPaymentId).toBe(paymentApprovedId);
  });

  it("updates order to CANCELLED when payment is rejected", async () => {
    paymentGetMock.mockResolvedValue({
      id: Number(paymentRejectedId),
      status: "rejected",
      external_reference: orderRejectedId,
    });

    const { POST } = await import("@/app/api/webhooks/mercadopago/route");

    const request = new NextRequest(
      `http://localhost:3000/api/webhooks/mercadopago`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          data: { id: paymentRejectedId },
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await prisma.order.findUnique({
      where: { id: orderRejectedId },
    });
    expect(updated?.status).toBe(OrderStatus.CANCELLED);
  });

  it("returns 200 and leaves order untouched for non-payment topic", async () => {
    const { POST } = await import("@/app/api/webhooks/mercadopago/route");

    const request = new NextRequest(
      `http://localhost:3000/api/webhooks/mercadopago`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "merchant_order",
          data: { id: "999" },
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(paymentGetMock).not.toHaveBeenCalled();
  });

  it("returns 200 and ignores webhook with missing/unknown external_reference", async () => {
    paymentGetMock.mockResolvedValue({
      id: 9999,
      status: "approved",
      external_reference: "nonexistent_order_id",
    });

    const { POST } = await import("@/app/api/webhooks/mercadopago/route");

    const request = new NextRequest(
      `http://localhost:3000/api/webhooks/mercadopago`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          data: { id: "9999" },
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
