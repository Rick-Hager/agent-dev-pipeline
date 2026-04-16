import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

const KDS_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_APPROVED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: KDS_STATUSES },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            priceInCents: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/restaurants/[slug]/kds error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
