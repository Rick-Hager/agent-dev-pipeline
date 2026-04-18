import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/mercadopago", () => ({
  createPixPayment: vi.fn(),
  createCardPayment: vi.fn(),
  fetchPaymentStatus: vi.fn(),
}));
import * as mp from "@/lib/mercadopago";
const createPixPaymentMock = vi.mocked(mp.createPixPayment);

import { POST as payPix } from "@/app/api/restaurants/[slug]/orders/[orderId]/pay/pix/route";

async function seed(opts: {
  accessToken?: string | null;
  customerEmail?: string | null;
} = {}) {
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
      customerEmail:
        opts.customerEmail === null ? null : opts.customerEmail ?? "m@e.com",
      totalInCents: 2500,
    },
  });
  return { restaurant, order };
}

describe("POST /api/restaurants/[slug]/orders/[orderId]/pay/pix", () => {
  beforeEach(() => {
    createPixPaymentMock.mockReset();
  });

  it("persists PIX fields and returns QR data on success", async () => {
    const { order } = await seed();
    createPixPaymentMock.mockResolvedValue({
      paymentId: "9001",
      qrCode: "00020126COPY",
      qrCodeBase64: "iVBOR64",
      ticketUrl: "https://mp.test/t/9001",
      expiresAt: new Date("2026-04-19T12:00:00Z"),
    });

    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.paymentId).toBe("9001");
    expect(data.qrCode).toBe("00020126COPY");
    expect(data.qrCodeBase64).toBe("iVBOR64");
    expect(data.ticketUrl).toBe("https://mp.test/t/9001");

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.mercadopagoPaymentId).toBe("9001");
    expect(updated?.paymentMethod).toBe("PIX");
    expect(updated?.status).toBe("PAYMENT_PENDING");
    expect(updated?.pixQrCode).toBe("00020126COPY");
    expect(updated?.pixQrCodeBase64).toBe("iVBOR64");
    expect(updated?.pixTicketUrl).toBe("https://mp.test/t/9001");
    expect(updated?.pixExpiresAt?.toISOString()).toBe("2026-04-19T12:00:00.000Z");
  });

  it("returns 400 when restaurant has no access token", async () => {
    const { order } = await seed({ accessToken: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
    expect(createPixPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 400 when order has no customerEmail", async () => {
    const { order } = await seed({ customerEmail: null });
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(400);
    expect(createPixPaymentMock).not.toHaveBeenCalled();
  });

  it("returns 502 when MP throws", async () => {
    const { order } = await seed();
    createPixPaymentMock.mockRejectedValue(new Error("MP 503"));
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}/pay/pix`,
      { method: "POST" }
    );
    const res = await payPix(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(502);
  });
});
