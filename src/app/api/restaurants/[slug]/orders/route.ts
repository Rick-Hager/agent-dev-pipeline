import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderStatus, Prisma } from "@prisma/client";
import {
  calculateOrderTotal,
  generateOrderNumber,
} from "@/lib/orderUtils";

export async function POST(
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

    const body = await request.json() as {
      customerName?: unknown;
      customerPhone?: unknown;
      items?: unknown;
    };

    const { customerName, customerPhone, items } = body;

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json(
        { error: "customerName is required" },
        { status: 400 }
      );
    }

    if (!customerPhone || typeof customerPhone !== "string") {
      return NextResponse.json(
        { error: "customerPhone is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    type ItemInput = { menuItemId: string; quantity: number };
    const itemInputs = items as ItemInput[];

    // Validate all menu items exist and are available
    const menuItemIds = itemInputs.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId: restaurant.id,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        { error: "One or more menu items not found" },
        { status: 400 }
      );
    }

    const unavailable = menuItems.find((mi) => !mi.isAvailable);
    if (unavailable) {
      return NextResponse.json(
        { error: `Menu item "${unavailable.name}" is not available` },
        { status: 400 }
      );
    }

    // Calculate total
    const itemsWithPrice = itemInputs.map((input) => {
      const menuItem = menuItems.find((mi) => mi.id === input.menuItemId)!;
      return {
        priceInCents: menuItem.priceInCents,
        quantity: input.quantity,
        menuItemId: input.menuItemId,
        name: menuItem.name,
      };
    });

    const totalInCents = calculateOrderTotal(itemsWithPrice);

    // Generate order number and create order with P2002 retry
    const MAX_RETRIES = 3;
    let order = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const orderNumber = await generateOrderNumber(restaurant.id);

        order = await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            orderNumber,
            customerName,
            customerPhone,
            totalInCents,
            status: OrderStatus.CREATED,
            items: {
              create: itemsWithPrice.map((item) => ({
                menuItemId: item.menuItemId,
                name: item.name,
                priceInCents: item.priceInCents,
                quantity: item.quantity,
              })),
            },
          },
          include: { items: true },
        });

        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < MAX_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      throw new Error("Failed to create order after max retries");
    }

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        totalInCents: order.totalInCents,
        status: order.status,
        items: order.items,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/restaurants/[slug]/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
      where: { restaurantId: restaurant.id },
      include: { items: true },
      orderBy: { orderNumber: "asc" },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/restaurants/[slug]/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
