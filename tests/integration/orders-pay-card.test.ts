import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/mercadopago", () => ({
  createPixPayment: vi.fn(),
  createCardPayment: vi.fn(),
  fetchPaymentStatus: vi.fn(),
}));
import * as mp from "@/lib/mercadopago";
const createCardPaymentMock = vi.mocked(mp.createCardPayment);

import { POST as payCard } from "@/app/api/restaurants/[slug]/orders/[orderId]/pay/card/route";

async function seed(opts: { accessToken?: string | null } = {}) {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
      mercadopagoAccessToken:
        opts.accessToken === null ? null : opts.accessToken ?? "APP_USR_token",
    },
  });
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      orderNumber: 1,
      customerName: "Maria",
      customerPhone: "11999999999",
      customerEmail: "maria@example.com",
      totalInCents: 5000,
    },
  });
  return { restaurant, order };
}

function validBody() {
  return {
    token: "card_tok_abc",
    paymentMethodId: "visa",
    issuerId: "25",
    installments: 1,
    cpf: "19119119100",
  };
}

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay/card", () => {
  beforeEach(() => {
    createCardPaymentMock.mockReset();
  });

  it("approves order on MP approved and returns 200", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "1234",
      status: "approved",
      statusDetail: "accredited",
    });

    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe("approved");

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("PAYMENT_APPROVED");
    expect(updated?.mercadopagoPaymentId).toBe("1234");
    expect(updated?.paymentMethod).toBe("CARD");
  });

  it("sets PAYMENT_PENDING on in_process", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "2",
      status: "in_process",
      statusDetail: "pending_review_manual",
    });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(200);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("PAYMENT_PENDING");
  });

  it("returns 402 and cancels on rejected", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockResolvedValue({
      paymentId: "3",
      status: "rejected",
      statusDetail: "cc_rejected_other_reason",
    });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(402);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("CANCELLED");
  });

  it("returns 400 without token", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody(), token: "" }),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid CPF", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody(), cpf: "123" }),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 without access token", async () => {
    const { order } = await seed({ accessToken: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when restaurant not found", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/nonexistent/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "nonexistent", orderId: order.id }),
    });
    expect(res.status).toBe(404);
    expect(createCardPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 404 when order not found or belongs to another restaurant", async () => {
    await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/nonexistent-order-id/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({
        slug: "test",
        orderId: "nonexistent-order-id",
      }),
    });
    expect(res.status).toBe(404);
    expect(createCardPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 502 when MercadoPago throws", async () => {
    const { order } = await seed();
    createCardPaymentMock.mockRejectedValue(new Error("boom"));
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      }
    );
    const res = await payCard(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(502);
  });
});
