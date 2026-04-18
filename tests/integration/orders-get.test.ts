import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { GET as getOrder } from "@/app/api/restaurants/[slug]/orders/[orderId]/route";

async function seed() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurant.deleteMany();
  const r = await prisma.restaurant.create({
    data: {
      name: "Test",
      slug: "test",
      email: "t@t.com",
      passwordHash: "x",
    },
  });
  const order = await prisma.order.create({
    data: {
      restaurantId: r.id,
      orderNumber: 1,
      customerName: "Maria",
      customerPhone: "11",
      customerEmail: "m@e.com",
      totalInCents: 1000,
      pixQrCode: "QRCODE",
      pixQrCodeBase64: "QRB64",
      pixTicketUrl: "https://mp/t/1",
      pixExpiresAt: new Date("2026-04-19T12:00:00Z"),
    },
  });
  return { order };
}

describe("GET /api/restaurants/[slug]/orders/[orderId] — PIX fields", () => {
  beforeEach(async () => {
    await seed();
  });

  it("includes PIX fields and customerEmail in response", async () => {
    const { order } = await seed();
    const req = new NextRequest(
      `http://test/api/restaurants/test/orders/${order.id}`
    );
    const res = await getOrder(req, {
      params: Promise.resolve({ slug: "test", orderId: order.id }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.customerEmail).toBe("m@e.com");
    expect(data.pixQrCode).toBe("QRCODE");
    expect(data.pixQrCodeBase64).toBe("QRB64");
    expect(data.pixTicketUrl).toBe("https://mp/t/1");
    expect(data.pixExpiresAt).toBe("2026-04-19T12:00:00.000Z");
  });
});
