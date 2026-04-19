import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { createPixPayment, type CreatedPixPayment } from "@/lib/mercadopago";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return request.nextUrl.origin;
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

    let pix: CreatedPixPayment;
    try {
      pix = await createPixPayment(restaurant.mercadopagoAccessToken, {
        orderId: order.id,
        amountInCents: order.totalInCents,
        orderNumber: order.orderNumber,
        description: `Pedido #${order.orderNumber} — ${restaurant.name}`,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        baseUrl: resolveBaseUrl(request),
      });
    } catch (mpError) {
      console.error("MercadoPago PIX creation failed:", mpError);
      return NextResponse.json(
        { error: "Payment provider error" },
        { status: 502 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentMethod: PaymentMethod.PIX,
        mercadopagoPaymentId: pix.paymentId,
        pixQrCode: pix.qrCode,
        pixQrCodeBase64: pix.qrCodeBase64,
        pixTicketUrl: pix.ticketUrl,
        pixExpiresAt: pix.expiresAt,
      },
    });

    return NextResponse.json({
      paymentId: pix.paymentId,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      expiresAt: pix.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /pay/pix handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
