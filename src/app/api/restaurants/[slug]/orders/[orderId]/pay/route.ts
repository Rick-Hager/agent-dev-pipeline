import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createOrderPaymentIntent } from "@/lib/stripe";

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

    if (!restaurant.stripeSecretKey || !restaurant.stripePublishableKey) {
      return NextResponse.json(
        { error: "Restaurant has no Stripe keys configured" },
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

    const intent = await createOrderPaymentIntent(restaurant.stripeSecretKey, {
      amountInCents: order.totalInCents,
      paymentMethod: paymentMethod as PaymentMethod,
      orderId: order.id,
      restaurantId: restaurant.id,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: paymentMethod as PaymentMethod,
        stripePaymentIntentId: intent.id,
      },
    });

    return NextResponse.json({
      clientSecret: intent.clientSecret,
      publishableKey: restaurant.stripePublishableKey,
      paymentMethod,
      paymentIntentId: intent.id,
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
