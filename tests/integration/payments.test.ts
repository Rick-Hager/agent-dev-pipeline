import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const createMock = vi.fn();
const constructEventMock = vi.fn();

vi.mock("stripe", () => {
  class MockStripe {
    public paymentIntents = { create: createMock };
    public webhooks = { constructEvent: constructEventMock };
    constructor(public readonly secretKey: string) {}
  }
  return { default: MockStripe };
});

const TEST_SLUG = "payment-api-test-restaurant";
const TEST_SLUG_NO_KEYS = "payment-api-no-keys-restaurant";

let restaurantId: string;
let restaurantIdNoKeys: string;
let menuItemId: string;

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Payment API Test Restaurant",
      slug: TEST_SLUG,
      email: "payment-api-test@integration-test.com",
      passwordHash: "hashed-password-placeholder",
      stripePublishableKey: "pk_test_123",
      stripeSecretKey: "sk_test_123",
    },
  });
  restaurantId = restaurant.id;

  const restaurantNoKeys = await prisma.restaurant.create({
    data: {
      name: "Payment API No Keys Restaurant",
      slug: TEST_SLUG_NO_KEYS,
      email: "payment-api-nokeys@integration-test.com",
      passwordHash: "hashed-password-placeholder",
    },
  });
  restaurantIdNoKeys = restaurantNoKeys.id;

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
    where: { slug: { in: [TEST_SLUG, TEST_SLUG_NO_KEYS] } },
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

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_abc",
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId: restaurantIdNoKeys } });
  });

  it("creates a PIX PaymentIntent, sets order to PAYMENT_PENDING, and returns client_secret", async () => {
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
    expect(body.clientSecret).toBe("pi_test_123_secret_abc");
    expect(body.publishableKey).toBe("pk_test_123");
    expect(body.paymentMethod).toBe("PIX");

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.status).toBe(OrderStatus.PAYMENT_PENDING);
    expect(updated?.paymentMethod).toBe("PIX");
    expect(updated?.stripePaymentIntentId).toBe("pi_test_123");
  });

  it("creates a CARD PaymentIntent with correct payment_method_types", async () => {
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
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ["card"],
        currency: "brl",
        amount: 1500,
      })
    );

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    expect(updated?.paymentMethod).toBe("CARD");
  });

  it("returns 400 when restaurant has no Stripe keys configured", async () => {
    const orderId = await createOrder(restaurantIdNoKeys, 2000);
    const { POST } = await import(
      "@/app/api/restaurants/[slug]/orders/[orderId]/pay/route"
    );

    const request = new NextRequest(
      `http://localhost:3000/api/restaurants/${TEST_SLUG_NO_KEYS}/orders/${orderId}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "PIX" }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ slug: TEST_SLUG_NO_KEYS, orderId }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/stripe/i);
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

describe("POST /api/webhooks/stripe", () => {
  let orderSucceededId: string;
  let orderFailedId: string;
  let paymentIntentSucceededId: string;
  let paymentIntentFailedId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

    paymentIntentSucceededId = "pi_succeed_1";
    paymentIntentFailedId = "pi_fail_1";

    const orderSucceeded = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 3000,
        customerName: "Webhook Succeeded",
        customerPhone: "+5511111111111",
        totalInCents: 1500,
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: "CARD",
        stripePaymentIntentId: paymentIntentSucceededId,
        items: {
          create: [
            { menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 },
          ],
        },
      },
    });
    orderSucceededId = orderSucceeded.id;

    const orderFailed = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber: 3001,
        customerName: "Webhook Failed",
        customerPhone: "+5511222222222",
        totalInCents: 1500,
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: "PIX",
        stripePaymentIntentId: paymentIntentFailedId,
        items: {
          create: [
            { menuItemId, name: "Burger", priceInCents: 1500, quantity: 1 },
          ],
        },
      },
    });
    orderFailedId = orderFailed.id;
  });

  beforeEach(() => {
    constructEventMock.mockReset();
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { id: { in: [orderSucceededId, orderFailedId] } },
    });
  });

  it("returns 400 on invalid signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "bad_sig" },
      body: "raw-payload",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("updates order to PAYMENT_APPROVED on payment_intent.succeeded", async () => {
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: paymentIntentSucceededId } },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_valid" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { object: { id: paymentIntentSucceededId } },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await prisma.order.findUnique({
      where: { id: orderSucceededId },
    });
    expect(updated?.status).toBe(OrderStatus.PAYMENT_APPROVED);
  });

  it("updates order to CANCELLED on payment_intent.payment_failed", async () => {
    constructEventMock.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: paymentIntentFailedId } },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig_valid" },
      body: JSON.stringify({
        type: "payment_intent.payment_failed",
        data: { object: { id: paymentIntentFailedId } },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await prisma.order.findUnique({
      where: { id: orderFailedId },
    });
    expect(updated?.status).toBe(OrderStatus.CANCELLED);
  });
});
