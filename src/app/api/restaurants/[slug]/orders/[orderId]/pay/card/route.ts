import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createCardPayment, type CreatedCardPayment } from "@/lib/mercadopago";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return request.nextUrl.origin;
}

function mapMpStatusToOrderStatus(mpStatus: string): OrderStatus {
  if (mpStatus === "approved") return OrderStatus.PAYMENT_APPROVED;
  if (mpStatus === "rejected" || mpStatus === "cancelled") {
    return OrderStatus.CANCELLED;
  }
  return OrderStatus.PAYMENT_PENDING;
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
    if (!order.customerEmail) {
      return NextResponse.json(
        { error: "Order has no customerEmail" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      token?: unknown;
      paymentMethodId?: unknown;
      issuerId?: unknown;
      cpf?: unknown;
    };

    if (typeof body.token !== "string" || body.token.length === 0) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }
    if (typeof body.paymentMethodId !== "string" || body.paymentMethodId.length === 0) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }
    if (typeof body.issuerId !== "string" || body.issuerId.length === 0) {
      return NextResponse.json(
        { error: "issuerId is required" },
        { status: 400 }
      );
    }
    if (typeof body.cpf !== "string" || !/^\d{11}$/.test(body.cpf)) {
      return NextResponse.json(
        { error: "cpf must be 11 digits" },
        { status: 400 }
      );
    }

    let card: CreatedCardPayment;
    try {
      card = await createCardPayment(restaurant.mercadopagoAccessToken, {
        orderId: order.id,
        amountInCents: order.totalInCents,
        orderNumber: order.orderNumber,
        description: `Pedido #${order.orderNumber} — ${restaurant.name}`,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        cpf: body.cpf,
        token: body.token,
        paymentMethodId: body.paymentMethodId,
        issuerId: body.issuerId,
        baseUrl: resolveBaseUrl(request),
      });
    } catch (mpError) {
      console.error("MercadoPago card creation failed:", mpError);
      return NextResponse.json(
        { error: "Payment provider error" },
        { status: 502 }
      );
    }

    const nextStatus = mapMpStatusToOrderStatus(card.status);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        paymentMethod: PaymentMethod.CARD,
        mercadopagoPaymentId: card.paymentId,
      },
    });

    const httpStatus = nextStatus === OrderStatus.CANCELLED ? 402 : 200;
    return NextResponse.json(
      {
        paymentId: card.paymentId,
        status: card.status,
        statusDetail: card.statusDetail,
      },
      { status: httpStatus }
    );
  } catch (error) {
    console.error("POST /pay/card handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
