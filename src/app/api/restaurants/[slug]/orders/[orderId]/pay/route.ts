import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createOrderPreference } from "@/lib/mercadopago";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const origin = request.nextUrl.origin;
  return origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (!restaurant.mercadopagoAccessToken) {
      return NextResponse.json(
        { error: "Restaurant has no MercadoPago access token configured" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: restaurant.id },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = (await request.json()) as { paymentMethod?: unknown };
    const { paymentMethod } = body;

    if (paymentMethod !== "PIX" && paymentMethod !== "CARD") {
      return NextResponse.json(
        { error: "paymentMethod must be 'PIX' or 'CARD'" },
        { status: 400 }
      );
    }

    const preference = await createOrderPreference(
      restaurant.mercadopagoAccessToken,
      {
        orderId: order.id,
        restaurantId: restaurant.id,
        amountInCents: order.totalInCents,
        paymentMethod: paymentMethod as PaymentMethod,
        orderNumber: order.orderNumber,
        itemsSummary: `Pedido #${order.orderNumber} — ${restaurant.name}`,
        baseUrl: resolveBaseUrl(request),
        slug: restaurant.slug,
      }
    );

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: paymentMethod as PaymentMethod,
        mercadopagoPreferenceId: preference.id,
      },
    });

    return NextResponse.json({
      redirectUrl: preference.initPoint,
      preferenceId: preference.id,
      paymentMethod,
    });
  } catch (error) {
    console.error(
      "POST /api/restaurants/[slug]/orders/[orderId]/pay error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
