import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { fetchPaymentStatus } from "@/lib/mercadopago";

function mapStatus(mpStatus: string): OrderStatus | null {
  if (mpStatus === "approved") return OrderStatus.PAYMENT_APPROVED;
  if (mpStatus === "rejected" || mpStatus === "cancelled") {
    return OrderStatus.CANCELLED;
  }
  return null;
}

function extractNotification(
  request: NextRequest,
  body: Record<string, unknown> | null
): { topic: string | null; paymentId: string | null } {
  const url = request.nextUrl;
  const topic =
    (body?.type as string | undefined) ??
    url.searchParams.get("type") ??
    url.searchParams.get("topic") ??
    null;

  let paymentId: string | null = null;
  if (body?.data && typeof body.data === "object") {
    const data = body.data as { id?: string | number };
    if (data.id !== undefined) paymentId = String(data.id);
  }
  if (!paymentId) {
    paymentId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      null;
  }

  return { topic, paymentId };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }

  const { topic, paymentId } = extractNotification(request, body);

  if (topic !== "payment" || !paymentId) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    const orderHint = await prisma.order.findFirst({
      where: { mercadopagoPaymentId: paymentId },
      select: { id: true, restaurant: { select: { mercadopagoAccessToken: true } } },
    });

    let accessToken = orderHint?.restaurant.mercadopagoAccessToken ?? null;

    if (!accessToken) {
      const restaurants = await prisma.restaurant.findMany({
        where: { mercadopagoAccessToken: { not: null } },
        select: { mercadopagoAccessToken: true },
        take: 1,
      });
      accessToken = restaurants[0]?.mercadopagoAccessToken ?? null;
    }

    if (!accessToken) {
      return NextResponse.json(
        { received: true, warning: "No restaurant has MercadoPago configured" },
        { status: 200 }
      );
    }

    const paymentStatus = await fetchPaymentStatus(accessToken, paymentId);

    if (!paymentStatus.externalReference) {
      return NextResponse.json(
        { received: true, warning: "Payment has no external_reference" },
        { status: 200 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: paymentStatus.externalReference },
    });

    if (!order) {
      return NextResponse.json(
        { received: true, warning: "Order not found for payment" },
        { status: 200 }
      );
    }

    const nextStatus = mapStatus(paymentStatus.status);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        mercadopagoPaymentId: paymentStatus.paymentId,
        ...(nextStatus ? { status: nextStatus } : {}),
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/webhooks/mercadopago handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
