import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const preferenceCreateMock = vi.fn();
const paymentGetMock = vi.fn();

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(public readonly options: { accessToken: string }) {}
  }
  class Preference {
    constructor(public readonly client: MercadoPagoConfig) {}
    create(args: unknown) {
      return preferenceCreateMock(args);
    }
  }
  class Payment {
    constructor(public readonly client: MercadoPagoConfig) {}
    get(args: unknown) {
      return paymentGetMock(args);
    }
  }
  return { MercadoPagoConfig, Preference, Payment };
});

const TEST_SLUG = "mp-payment-api-test-restaurant";
const TEST_SLUG_NO_TOKEN = "mp-payment-api-no-token-restaurant";

let restaurantId: string;
let restaurantIdNoToken: string;
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

  const restaurantNoToken = await prisma.restaurant.create({
    data: {
      name: "MP Payment API No Token Restaurant",
      slug: TEST_SLUG_NO_TOKEN,
      email: "mp-payment-api-notoken@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantIdNoToken = restaurantNoToken.id;

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
    where: { slug: { in: [TEST_SLUG, TEST_SLUG_NO_TOKEN] } },
  });
});

async function createOrder(
  restaurantIdArg: string,
  orderNumber: number,
  status: OrderStatus = OrderStatus.CREATED
): Promise<string> {
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurantIdArg,
      orderNumber,
      customerName: "Test Customer",
      customerPhone: "+5511999999999",
      totalInCents: 1500,
      status,
      items: {
        create: [
          { menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 },
        ],
      },
    },
  });
  return order.id;
}

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay (MercadoPago)", () => {
  beforeEach(() => {
    preferenceCreateMock.mockReset();
    preferenceCreateMock.mockResolvedValue({
      id: "pref_test_123",
      init_point: "https://mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123",
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId: restaurantIdNoToken } });
  });

  it("creates a Preference with PIX, sets order to PAYMENT_PENDING, returns redirect URL", async () => {
    const orderId = await createOrder(restaurantId, 1000);
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "PIX" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirectUrl).toBe(
      "https://mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123"
    );
    expect(body.preferenceId).toBe("pref_test_123");
    expect(body.paymentMethod).toBe("PIX");

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.status).toBe(OrderStatus.PAYMENT_PENDING);
    expect(updated?.paymentMethod).toBe("PIX");
  });

  it("creates a Preference with CARD", async () => {
    const orderId = await createOrder(restaurantId, 1001);
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "CARD" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.paymentMethod).toBe("CARD");

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.paymentMethod).toBe("CARD");
  });

  it("returns 400 when restaurant has no MercadoPago token configured", async () => {
    const orderId = await createOrder(restaurantIdNoToken, 2000);
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG_NO_TOKEN}/orders/${orderId}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "PIX" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG_NO_TOKEN, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/mercadopago/i);
  });

  it("returns 404 when restaurant is not found", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/nonexistent/orders/whatever/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "PIX" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: "nonexistent", orderId: "whatever" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 when order is not found", async () => {
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/nonexistent/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "PIX" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId: "nonexistent" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 when paymentMethod is invalid", async () => {
    const orderId = await createOrder(restaurantId, 1002);
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG}/orders/${orderId}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "BITCOIN" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG, orderId }),
    });
    expect(response.status).toBe(400);
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
